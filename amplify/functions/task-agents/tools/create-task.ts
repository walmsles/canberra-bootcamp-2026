import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { randomUUID } from 'crypto';

const logger = new Logger({ serviceName: 'task-agents' });

const KNOWN_FIELDS = new Set([
  'title',
  'description',
  'status',
  'dueDate',
  'completedAt',
  'tags',
  'reminderMinutes',
  'reminderSent',
  'priority',
  'effortHours',
  'listId',
]);

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETE'] as const;
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export interface CreateTaskInput {
  title?: string;
  listId?: string;
  description?: string;
  status?: string;
  priority?: string;
  effortHours?: number;
  dueDate?: string;
  completedAt?: string;
  tags?: string[];
  reminderMinutes?: number;
  reminderSent?: boolean;
  [key: string]: unknown;
}

export interface CreateTaskResult {
  success: boolean;
  item?: Record<string, unknown>;
  error?: string;
}

export function buildCreateTaskItem(
  input: CreateTaskInput,
  owner: string,
): { item: Record<string, unknown> | null; error: string | null; unknownFields: string[] } {
  const unknownFields: string[] = [];

  // Validate required fields
  if (!input.title) {
    return { item: null, error: 'Missing required field: title', unknownFields };
  }
  if (!input.listId) {
    return { item: null, error: 'Missing required field: listId', unknownFields };
  }

  // Validate status enum if provided
  if (input.status && !(VALID_STATUSES as readonly string[]).includes(input.status)) {
    return {
      item: null,
      error: `Invalid status: ${input.status}. Valid values: ${VALID_STATUSES.join(', ')}`,
      unknownFields,
    };
  }

  // Validate priority enum if provided
  if (input.priority && !(VALID_PRIORITIES as readonly string[]).includes(input.priority)) {
    return {
      item: null,
      error: `Invalid priority: ${input.priority}. Valid values: ${VALID_PRIORITIES.join(', ')}`,
      unknownFields,
    };
  }

  // Validate dueDate format if provided - must be ISO 8601 with time
  if (input.dueDate) {
    const dateStr = String(input.dueDate);
    // Check if it's just a date (YYYY-MM-DD) without time
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return {
        item: null,
        error: `Invalid dueDate format: ${dateStr}. Must be ISO 8601 with time (e.g., 2026-03-05T23:59:59.999Z), not just a date.`,
        unknownFields,
      };
    }
    // Check if it's a valid ISO 8601 datetime
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return {
        item: null,
        error: `Invalid dueDate: ${dateStr}. Must be a valid ISO 8601 datetime.`,
        unknownFields,
      };
    }
  }

  // Strip unknown fields
  for (const key of Object.keys(input)) {
    if (!KNOWN_FIELDS.has(key)) {
      unknownFields.push(key);
    }
  }

  // Build item with only known fields
  const item: Record<string, unknown> = {
    id: randomUUID(),
    owner,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  for (const key of KNOWN_FIELDS) {
    if (input[key] !== undefined) {
      item[key] = input[key];
    }
  }

  return { item, error: null, unknownFields };
}

export async function createTask(
  input: CreateTaskInput,
  docClient: DynamoDBDocumentClient,
  tableName: string,
  owner: string,
): Promise<CreateTaskResult> {
  const { item, error, unknownFields } = buildCreateTaskItem(input, owner);

  if (unknownFields.length > 0) {
    logger.warn('Unknown fields stripped from create_task input', { unknownFields });
  }

  if (error || !item) {
    return { success: false, error: error ?? 'Unknown error' };
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      }),
    );
    return { success: true, item };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DynamoDB PutItem failed';
    logger.error('create_task DynamoDB error', { error: err });
    return { success: false, error: message };
  }
}
