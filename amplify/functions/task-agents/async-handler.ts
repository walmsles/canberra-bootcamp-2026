import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
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
import type { DynamoDBStreamEvent } from 'aws-lambda';

const KNOWN_QUERY_TYPES = ['breakdownProject', 'analyzeTask', 'planDay', 'recommendTask'] as const;

const logger = new Logger({ serviceName: 'task-agents-async' });

const SOPS_DIR = '/tmp/sops';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const todoItemTable = process.env.TODOITEM_TABLE_NAME ?? '';
const todoListTable = process.env.TODOLIST_TABLE_NAME ?? '';
const agentJobTable = process.env.AGENTJOB_TABLE_NAME ?? '';

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

async function updateJobStatus(
  jobId: string,
  owner: string,
  status: 'PROCESSING' | 'COMPLETE' | 'FAILED',
  resultData?: unknown,
  error?: string
) {
  const now = new Date().toISOString();
  
  const updateExpression = status === 'PROCESSING'
    ? 'SET #status = :status, startedAt = :now'
    : 'SET #status = :status, completedAt = :now' + 
      (resultData ? ', resultData = :resultData' : '') +
      (error ? ', #error = :error' : '');

  const expressionAttributeValues: Record<string, { S: string }> = {
    ':status': { S: status },
    ':now': { S: now },
  };

  if (resultData) {
    expressionAttributeValues[':resultData'] = { S: JSON.stringify(resultData) };
  }

  if (error) {
    expressionAttributeValues[':error'] = { S: error };
  }

  const command = new UpdateItemCommand({
    TableName: agentJobTable,
    Key: {
      id: { S: jobId },
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: {
      '#status': 'status',
      ...(error ? { '#error': 'error' } : {}),
    },
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await ddbClient.send(command);
  logger.info('Updated job status', { jobId, status });
}

// DynamoDB Stream handler - processes new AgentJob records
export const handler = async (event: DynamoDBStreamEvent) => {
  logger.info('Processing DynamoDB stream', { recordCount: event.Records.length });

  for (const record of event.Records) {
    // Only process INSERT events with PENDING status
    if (record.eventName !== 'INSERT') continue;

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    const jobId = newImage.id?.S;
    const owner = newImage.owner?.S;
    const status = newImage.status?.S;
    const queryType = newImage.queryType?.S;
    
    // requestData is stored as a Map (M) in DynamoDB when using Amplify's json type
    let requestData: Record<string, unknown> = {};
    if (newImage.requestData?.M) {
      // Convert DynamoDB Map to plain object
      const mapData = newImage.requestData.M;
      for (const [key, value] of Object.entries(mapData)) {
        if (value.S) requestData[key] = value.S;
        else if (value.N) requestData[key] = Number(value.N);
        else if (value.BOOL !== undefined) requestData[key] = value.BOOL;
        else if (value.NULL) requestData[key] = null;
      }
    } else if (newImage.requestData?.S) {
      // Fallback: if it's stored as a string, parse it
      requestData = JSON.parse(newImage.requestData.S) as Record<string, unknown>;
    }

    if (!jobId || !owner || status !== 'PENDING' || !queryType) {
      logger.warn('Skipping invalid record', { jobId, owner, status, queryType, requestData });
      continue;
    }

    logger.info('Processing agent job', { jobId, queryType, owner, requestData });

    try {
      // Update status to PROCESSING
      await updateJobStatus(jobId, owner, 'PROCESSING');

      // Initialize SOPs and tools
      writeSopsToDisk();

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
          const result = await createTask(input as Record<string, unknown>, docClient, todoItemTable, owner);
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
          const result = await getLists(docClient, todoListTable);
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
          const result = await createTasks(typedInput, docClient, todoItemTable, owner);
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

      const now = new Date();
      let prompt: string;

      if (queryType && KNOWN_QUERY_TYPES.includes(queryType as (typeof KNOWN_QUERY_TYPES)[number])) {
        prompt = buildSpecialistPrompt({ ...requestData, queryType }, now);
        logger.info('Routing to specialist', { queryType });
      } else if (requestData.query && typeof requestData.query === 'string') {
        prompt = enrichQuery(requestData.query as string, now);
        logger.info('Using enriched query', { queryType: 'freeform' });
      } else {
        logger.warn('No queryType or query found, using requestData as prompt', { requestData });
        prompt = buildSpecialistPrompt(requestData, now);
      }

      // Invoke orchestrator
      const result = await orchestrator.invoke(prompt);

      // Validate and store response
      const validated = validateAgentResponse(String(result));

      await updateJobStatus(jobId, owner, 'COMPLETE', validated);

      logger.info('Job completed successfully', { jobId, queryType });
    } catch (error) {
      logger.error('Job failed', { jobId, error });
      await updateJobStatus(
        jobId,
        owner,
        'FAILED',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
};
