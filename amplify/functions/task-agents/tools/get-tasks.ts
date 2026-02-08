import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'task-agents' });

const KNOWN_FILTERS = new Set(['listId', 'status', 'dueDateBefore', 'dueDateAfter']);

export interface GetTasksInput {
  listId?: string;
  status?: string;
  dueDateBefore?: string;
  dueDateAfter?: string;
  [key: string]: unknown;
}

export interface GetTasksResult {
  success: boolean;
  items?: Record<string, unknown>[];
  error?: string;
}

export function buildGetTasksQuery(
  input: GetTasksInput,
  tableName: string,
): {
  command: 'query' | 'scan';
  params: Record<string, unknown>;
  unknownFields: string[];
} {
  const unknownFields: string[] = [];
  for (const key of Object.keys(input)) {
    if (!KNOWN_FILTERS.has(key)) {
      unknownFields.push(key);
    }
  }

  const { listId, status, dueDateBefore, dueDateAfter } = input;

  // Build date filter expressions (used across strategies)
  const dateFilterParts: string[] = [];
  const exprValues: Record<string, unknown> = {};

  if (dueDateAfter) {
    dateFilterParts.push('dueDate >= :dueDateAfter');
    exprValues[':dueDateAfter'] = dueDateAfter;
  }
  if (dueDateBefore) {
    dateFilterParts.push('dueDate <= :dueDateBefore');
    exprValues[':dueDateBefore'] = dueDateBefore;
  }

  // Strategy: listId provided → use byList GSI
  if (listId) {
    const keyExpr = 'listId = :listId';
    exprValues[':listId'] = listId;

    // Due date range can be a sort key condition on byList GSI
    let sortKeyExpr: string | undefined;
    const sortKeyParts: string[] = [];
    if (dueDateAfter && dueDateBefore) {
      sortKeyExpr = 'dueDate BETWEEN :dueDateAfter AND :dueDateBefore';
    } else if (dueDateAfter) {
      sortKeyParts.push('dueDate >= :dueDateAfter');
      sortKeyExpr = sortKeyParts.join(' AND ');
    } else if (dueDateBefore) {
      sortKeyParts.push('dueDate <= :dueDateBefore');
      sortKeyExpr = sortKeyParts.join(' AND ');
    }

    const fullKeyExpr = sortKeyExpr ? `${keyExpr} AND ${sortKeyExpr}` : keyExpr;

    // Status becomes a filter expression
    let filterExpr: string | undefined;
    if (status) {
      filterExpr = '#status = :status';
      exprValues[':status'] = status;
    }

    const params: Record<string, unknown> = {
      TableName: tableName,
      IndexName: 'byList',
      KeyConditionExpression: fullKeyExpr,
      ExpressionAttributeValues: exprValues,
    };
    if (filterExpr) {
      params.FilterExpression = filterExpr;
      params.ExpressionAttributeNames = { '#status': 'status' };
    }

    return { command: 'query', params, unknownFields };
  }

  // Strategy: status provided (no listId) → use byStatus GSI
  if (status) {
    const keyExpr = '#status = :status';
    exprValues[':status'] = status;

    let sortKeyExpr: string | undefined;
    if (dueDateAfter && dueDateBefore) {
      sortKeyExpr = 'dueDate BETWEEN :dueDateAfter AND :dueDateBefore';
    } else if (dueDateAfter) {
      sortKeyExpr = 'dueDate >= :dueDateAfter';
    } else if (dueDateBefore) {
      sortKeyExpr = 'dueDate <= :dueDateBefore';
    }

    const fullKeyExpr = sortKeyExpr ? `${keyExpr} AND ${sortKeyExpr}` : keyExpr;

    const params: Record<string, unknown> = {
      TableName: tableName,
      IndexName: 'byStatus',
      KeyConditionExpression: fullKeyExpr,
      ExpressionAttributeValues: exprValues,
      ExpressionAttributeNames: { '#status': 'status' },
    };

    return { command: 'query', params, unknownFields };
  }

  // Strategy: only date filters or no filters → scan
  const filterParts = [...dateFilterParts];
  const params: Record<string, unknown> = { TableName: tableName };

  if (filterParts.length > 0) {
    params.FilterExpression = filterParts.join(' AND ');
    params.ExpressionAttributeValues = exprValues;
  }

  return { command: 'scan', params, unknownFields };
}

export async function getTasks(
  input: GetTasksInput,
  docClient: DynamoDBDocumentClient,
  tableName: string,
): Promise<GetTasksResult> {
  const { command, params, unknownFields } = buildGetTasksQuery(input, tableName);

  if (unknownFields.length > 0) {
    logger.warn('Unknown filter fields ignored in get_tasks', { unknownFields });
  }

  try {
    let items: Record<string, unknown>[];
    if (command === 'query') {
      const result = await docClient.send(new QueryCommand(params as ConstructorParameters<typeof QueryCommand>[0]));
      items = (result.Items ?? []) as Record<string, unknown>[];
    } else {
      const result = await docClient.send(new ScanCommand(params as ConstructorParameters<typeof ScanCommand>[0]));
      items = (result.Items ?? []) as Record<string, unknown>[];
    }
    return { success: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DynamoDB query failed';
    logger.error('get_tasks DynamoDB error', { error: err });
    return { success: false, error: message };
  }
}
