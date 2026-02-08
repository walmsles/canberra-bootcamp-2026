import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { createOrchestrator } from '@serverless-dna/sop-agents';
import { FunctionTool } from '@strands-agents/sdk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { enrichQuery } from './enrich-query.js';
import { allSops } from './sops-bundle.js';
import { createTask } from './tools/create-task.js';
import { getTasks } from './tools/get-tasks.js';
import { getLists } from './tools/get-lists.js';

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
    const result = await createTask(input as Record<string, unknown>, docClient, todoItemTable, 'agent');
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

export const handler = async (event: { arguments: { query: string } }) => {
  logger.info('Received event', { event });

  writeSopsToDisk();

  const orchestrator = await createOrchestrator({
    directory: SOPS_DIR,
    tools: {
      create_task: createTaskTool,
      get_tasks: getTasksTool,
      get_lists: getListsTool,
    },
  });

  const enrichedQuery = enrichQuery(event.arguments.query, new Date());

  logger.info('Invoking orchestrator', { enrichedQuery });

  const result = await orchestrator.invoke(enrichedQuery);

  logger.info('Orchestrator result', { result });

  return result;
};
