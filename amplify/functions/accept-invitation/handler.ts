import type { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'accept-invitation' });

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface AcceptInvitationArguments {
  invitationId: string;
  groupId: string;
  userId: string;
  userEmail: string;
}

interface AcceptInvitationResult {
  success: boolean;
  message: string;
  groupId?: string;
}

export const handler: AppSyncResolverHandler<
  AcceptInvitationArguments,
  AcceptInvitationResult
> = async (event) => {
  logger.info('Received event', { event });
  
  const { invitationId, groupId, userId, userEmail } = event.arguments;
  
  logger.info('Parsed arguments', { invitationId, groupId, userId, userEmail });
  
  const listGroupTable = process.env.LISTGROUP_TABLE_NAME;
  const groupInvitationTable = process.env.GROUPINVITATION_TABLE_NAME;

  logger.info('Table names', { listGroupTable, groupInvitationTable });

  if (!listGroupTable || !groupInvitationTable) {
    logger.error('Table names not configured');
    return {
      success: false,
      message: 'Table names not configured',
    };
  }

  try {
    // First, verify the invitation exists and is pending
    logger.info('Getting invitation', { invitationId });
    const invitationResult = await docClient.send(
      new GetCommand({
        TableName: groupInvitationTable,
        Key: { id: invitationId },
      })
    );

    logger.info('Invitation result', { item: invitationResult.Item });

    if (!invitationResult.Item) {
      logger.warn('Invitation not found');
      return {
        success: false,
        message: 'Invitation not found',
      };
    }

    if (invitationResult.Item.status !== 'PENDING') {
      logger.warn('Invitation is no longer pending', { status: invitationResult.Item.status });
      return {
        success: false,
        message: 'Invitation is no longer pending',
      };
    }

    // Atomically append user to memberIds and memberEmails using list_append
    // This avoids the read-modify-write race condition
    logger.info('Updating group with new member', { groupId, userId, userEmail });
    await docClient.send(
      new UpdateCommand({
        TableName: listGroupTable,
        Key: { id: groupId },
        UpdateExpression: 'SET memberIds = list_append(if_not_exists(memberIds, :empty), :userId), memberEmails = list_append(if_not_exists(memberEmails, :empty), :userEmail)',
        ExpressionAttributeValues: {
          ':userId': [userId],
          ':userEmail': [userEmail.toLowerCase()],
          ':empty': [],
        },
        // Ensure the group exists
        ConditionExpression: 'attribute_exists(id)',
      })
    );

    logger.info('Group updated successfully');

    // Update invitation status to ACCEPTED
    logger.info('Updating invitation status', { invitationId });
    await docClient.send(
      new UpdateCommand({
        TableName: groupInvitationTable,
        Key: { id: invitationId },
        UpdateExpression: 'SET #status = :status, invitedUserId = :userId',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'ACCEPTED',
          ':userId': userId,
        },
      })
    );

    logger.info('Invitation accepted successfully', { groupId });

    return {
      success: true,
      message: 'Successfully joined the group',
      groupId,
    };
  } catch (error) {
    logger.error('Error accepting invitation', { error });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};
