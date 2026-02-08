import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'task-agents' });

export interface TodoListItem {
  id: string;
  name: string;
  description?: string;
}

export interface GetListsResult {
  success: boolean;
  items?: TodoListItem[];
  error?: string;
}

export async function getLists(
  docClient: DynamoDBDocumentClient,
  tableName: string,
): Promise<GetListsResult> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: 'id, #name, description',
        ExpressionAttributeNames: { '#name': 'name' },
      }),
    );

    const items = (result.Items ?? []).map((item) => ({
      id: item.id as string,
      name: item.name as string,
      description: item.description as string | undefined,
    }));

    return { success: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DynamoDB scan failed';
    logger.error('get_lists DynamoDB error', { error: err });
    return { success: false, error: message };
  }
}
