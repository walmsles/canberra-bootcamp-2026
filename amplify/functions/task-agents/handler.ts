import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { createOrchestrator } from '@serverless-dna/sop-agents';
import { FunctionTool } from '@strands-agents/sdk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { enrichQuery } from './enrich-query.js';
import { validateAgentResponse } from './validate-response.js';
import { allSops } from './sops-bundle.js';
import { createTask } from './tools/create-task.js';
import { getTasks } from './tools/get-tasks.js';
import { getLists } from './tools/get-lists.js';
import { createTasks } from './tools/create-tasks.js';

const KNOWN_QUERY_TYPES = ['breakdownProject', 'analyzeTask', 'planDay', 'recommendTask'] as const;

const logger = new Logger({ serviceName: 'task-agents' });

const SOPS_DIR = '/tmp/sops';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const todoItemTable = process.env.TODOITEM_TABLE_NAME ?? '';
const todoListTable = process.env.TODOLIST_TABLE_NAME ?? '';

function writeSopsToDisk() {
  if (existsSync(SOPS_DIR)) return;
  mkdirSync(SOPS_DIR, { recursive: true });
  for (const [filename, content] of Object.entries(allSops)) {
    writeFileSync(`${SOPS_DIR}/${filename}`, content);
  }
  logger.info('Wrote SOPs to disk', { count: Object.keys(allSops).length });
}
function buildSpecialistPrompt(args: Record<string, unknown>, now: Date): string {
  const timestamp = now.toISOString();
  const dateOnly = timestamp.split('T')[0];
  const timeOnly = now.toTimeString().split(' ')[0];
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  const lines = [
    `Current Date and Time: ${timestamp}`,
    `Date: ${dateOnly} (${dayOfWeek})`,
    `Time: ${timeOnly}`,
  ];

  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) {
      lines.push(`${key}: ${String(value)}`);
    }
  }

  return lines.join('\n');
}

export const handler = async (event: { 
  arguments: Record<string, unknown>; 
  fieldName?: string;
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, unknown>;
  };
}) => {
  logger.info('Received event', { 
    fieldName: event.fieldName, 
    arguments: event.arguments,
    identity: event.identity 
  });

  // Extract user identity - use sub claim as owner
  const userId = event.identity?.sub ?? event.identity?.username ?? 'agent';
  logger.info('User identity', { userId });

  writeSopsToDisk();

  const startTime = Date.now();

  // Create tools with userId in scope
  const createTaskTool = new FunctionTool({
    name: 'create_task',
    description: 'Create a new todo item in a specified list',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title (required)' },
        listId: { type: 'string', description: 'ID of the list to add the task to (required)' },
        description: { type: 'string', description: 'Task description' },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETE'], description: 'Task status' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Task priority' },
        effortHours: { type: 'number', description: 'Estimated effort in hours' },
        dueDate: { type: 'string', description: 'Due date in ISO 8601 format' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the task' },
        reminderMinutes: { type: 'number', description: 'Minutes before due date to send reminder' },
      },
      required: ['title', 'listId'],
    },
    callback: async (input: unknown) => {
      const result = await createTask(input as Record<string, unknown>, docClient, todoItemTable, userId);
      return JSON.stringify(result);
    },
  });

  const getTasksTool = new FunctionTool({
    name: 'get_tasks',
    description: 'Retrieve and filter todo items by list, status, or due date',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'Filter by list ID' },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETE'], description: 'Filter by status' },
        dueDateBefore: { type: 'string', description: 'Filter tasks due before this ISO 8601 date' },
        dueDateAfter: { type: 'string', description: 'Filter tasks due after this ISO 8601 date' },
      },
    },
    callback: async (input: unknown) => {
      const result = await getTasks(input as Record<string, unknown>, docClient, todoItemTable);
      return JSON.stringify(result);
    },
  });

  const getListsTool = new FunctionTool({
    name: 'get_lists',
    description: 'Retrieve all available todo lists',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    callback: async () => {
      logger.info('Tool call: get_lists');
      const result = await getLists(docClient, todoListTable);
      logger.info('Tool result: get_lists', { listCount: result.items?.length ?? 0, success: result.success });
      return JSON.stringify(result);
    },
  });

  const createTasksTool = new FunctionTool({
    name: 'create_tasks',
    description: 'Create multiple todo items in a single batch call',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'ID of the list to add tasks to (required)' },
        tasks: {
          type: 'array',
          description: 'Array of task objects to create (required)',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title (required)' },
              description: { type: 'string', description: 'Task description' },
              status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETE'], description: 'Task status' },
              priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Task priority' },
              effortHours: { type: 'number', description: 'Estimated effort in hours' },
              dueDate: { type: 'string', description: 'Due date in ISO 8601 format' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the task' },
              reminderMinutes: { type: 'number', description: 'Minutes before due date to send reminder' },
            },
            required: ['title'],
          },
        },
      },
      required: ['listId', 'tasks'],
    },
    callback: async (input: unknown) => {
      const typedInput = input as { listId: string; tasks: Array<Record<string, unknown>> };
      const result = await createTasks(typedInput, docClient, todoItemTable, userId);
      return JSON.stringify(result);
    },
  });

  const orchestrator = await createOrchestrator({
    directory: SOPS_DIR,
    defaultModel: 'au.anthropic.claude-sonnet-4-5-20250929-v1:0',
    logLevel: 'debug',
    tools: {
      create_task: createTaskTool,
      create_tasks: createTasksTool,
      get_tasks: getTasksTool,
      get_lists: getListsTool,
    },
  });

  const initDuration = Date.now() - startTime;
  logger.info('Orchestrator initialized', { initDurationMs: initDuration });

  const args = event.arguments;
  const now = new Date();
  let prompt: string;

  // Determine queryType from explicit field, Amplify fieldName, or fallback
  const queryType = ('queryType' in args && typeof args.queryType === 'string')
    ? args.queryType
    : event.fieldName;

  if (queryType && KNOWN_QUERY_TYPES.includes(queryType as (typeof KNOWN_QUERY_TYPES)[number])) {
    prompt = buildSpecialistPrompt({ ...args, queryType }, now);
    logger.info('Routing to specialist', { queryType });
  } else if ('query' in args && typeof args.query === 'string') {
    prompt = enrichQuery(args.query, now);
    logger.info('Using enriched query', { queryType: 'freeform' });
  } else {
    logger.warn('No queryType or query found, using args as prompt', { args });
    prompt = buildSpecialistPrompt(args, now);
  }

  logger.debug('Built prompt', { prompt });

  const invokeStart = Date.now();
  let result: string;
  try {
    result = await orchestrator.invoke(prompt);
  } catch (err) {
    const invokeDuration = Date.now() - invokeStart;
    logger.error('Orchestrator invocation failed', {
      error: err instanceof Error ? err.message : String(err),
      queryType,
      invokeDurationMs: invokeDuration,
    });
    throw err;
  }

  const invokeDuration = Date.now() - invokeStart;
  const totalDuration = Date.now() - startTime;

  const validated = validateAgentResponse(String(result));

  logger.info('Request complete', {
    queryType,
    success: validated.success,
    invokeDurationMs: invokeDuration,
    totalDurationMs: totalDuration,
  });

  return JSON.stringify(validated);
};
