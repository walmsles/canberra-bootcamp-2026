import { DynamoDBDocumentClient, BatchWriteCommand, BatchWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { buildCreateTaskItem, CreateTaskInput } from './create-task.js';

const logger = new Logger({ serviceName: 'task-agents' });

const CHUNK_SIZE = 25;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

export interface CreateTasksInput {
  listId: string;
  tasks: Array<CreateTaskInput>;
}

export interface CreateTasksResult {
  success: boolean;
  createdCount: number;
  items?: Record<string, unknown>[];
  errors?: string[];
  error?: string;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createTasks(
  input: CreateTasksInput,
  docClient: DynamoDBDocumentClient,
  tableName: string,
  owner: string,
): Promise<CreateTasksResult> {
  if (!input.listId) {
    return { success: false, createdCount: 0, error: 'Missing required field: listId' };
  }

  if (!input.tasks || input.tasks.length === 0) {
    return { success: false, createdCount: 0, error: 'tasks array is empty' };
  }

  // Validate all tasks first — all-or-nothing
  const validatedItems: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < input.tasks.length; i++) {
    const task = input.tasks[i];
    const { item, error } = buildCreateTaskItem({ ...task, listId: input.listId }, owner);
    if (error || !item) {
      errors.push(`Task ${i}: ${error ?? 'Unknown validation error'}`);
    } else {
      validatedItems.push(item);
    }
  }

  if (errors.length > 0) {
    return { success: false, createdCount: 0, errors };
  }

  // Chunk and write
  const chunks = chunkArray(validatedItems, CHUNK_SIZE);
  let totalWritten = 0;

  for (const chunk of chunks) {
    let unprocessed: Record<string, unknown>[] | undefined = chunk;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (!unprocessed || unprocessed.length === 0) break;

      try {
        const command: BatchWriteCommand = new BatchWriteCommand({
          RequestItems: {
            [tableName]: unprocessed.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
        });

        const response: BatchWriteCommandOutput = await docClient.send(command);

        const remaining = response.UnprocessedItems?.[tableName];
        if (remaining && remaining.length > 0) {
          const writtenThisCall = unprocessed.length - remaining.length;
          totalWritten += writtenThisCall;
          unprocessed = remaining.map((r: { PutRequest?: { Item?: Record<string, unknown> } }) => r.PutRequest!.Item as Record<string, unknown>);

          if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            await sleep(delay);
          }
        } else {
          totalWritten += unprocessed.length;
          unprocessed = undefined;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'DynamoDB BatchWriteItem failed';
        logger.error('create_tasks DynamoDB error', { error: err, totalWritten });
        return {
          success: false,
          createdCount: totalWritten,
          error: `${message} (${totalWritten} items written before failure)`,
        };
      }
    }

    if (unprocessed && unprocessed.length > 0) {
      logger.error('create_tasks retries exhausted', { unprocessedCount: unprocessed.length, totalWritten });
      return {
        success: false,
        createdCount: totalWritten,
        error: `Retries exhausted: ${unprocessed.length} items could not be written (${totalWritten} items written successfully)`,
      };
    }
  }

  return {
    success: true,
    createdCount: totalWritten,
    items: validatedItems,
  };
}
