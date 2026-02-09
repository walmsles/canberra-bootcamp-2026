import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { acceptInvitation } from './functions/accept-invitation/resource';
import { taskAgents } from './functions/task-agents/resource';

const backend = defineBackend({
  auth,
  data,
  acceptInvitation,
  taskAgents,
});

// Grant the accept-invitation function access to the DynamoDB tables
const listGroupTable = backend.data.resources.tables['ListGroup'];
const groupInvitationTable = backend.data.resources.tables['GroupInvitation'];

// Grant read/write access to the tables
listGroupTable.grantReadWriteData(backend.acceptInvitation.resources.lambda);
groupInvitationTable.grantReadWriteData(backend.acceptInvitation.resources.lambda);

// Pass table names to the function as environment variables
backend.acceptInvitation.addEnvironment('LISTGROUP_TABLE_NAME', listGroupTable.tableName);
backend.acceptInvitation.addEnvironment('GROUPINVITATION_TABLE_NAME', groupInvitationTable.tableName);

// Grant the task-agents function access to DynamoDB tables
const todoItemTable = backend.data.resources.tables['TodoItem'];
const todoListTable = backend.data.resources.tables['TodoList'];
const agentJobTable = backend.data.resources.tables['AgentJob'];

todoItemTable.grantReadWriteData(backend.taskAgents.resources.lambda);
todoListTable.grantReadData(backend.taskAgents.resources.lambda);
agentJobTable.grantReadWriteData(backend.taskAgents.resources.lambda);

backend.taskAgents.addEnvironment('TODOITEM_TABLE_NAME', todoItemTable.tableName);
backend.taskAgents.addEnvironment('TODOLIST_TABLE_NAME', todoListTable.tableName);
backend.taskAgents.addEnvironment('AGENTJOB_TABLE_NAME', agentJobTable.tableName);
backend.taskAgents.addEnvironment('TZ', 'Australia/Sydney');
// GraphQL endpoint URL is constructed from the API ID
backend.taskAgents.addEnvironment(
  'AMPLIFY_GRAPHQL_ENDPOINT',
  `https://${backend.data.resources.graphqlApi.apiId}.appsync-api.${backend.stack.region}.amazonaws.com/graphql`
);

// Grant Bedrock permissions for Claude models (foundation models + cross-region inference profiles)
backend.taskAgents.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: [
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
      `arn:aws:bedrock:*:${backend.stack.account}:inference-profile/global.anthropic.claude-*`,
      `arn:aws:bedrock:*:${backend.stack.account}:inference-profile/au.anthropic.claude-*`,
    ],
  }),
);

// Grant AppSync permissions to update AgentJob via GraphQL
backend.taskAgents.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['appsync:GraphQL'],
    resources: [`${backend.data.resources.graphqlApi.arn}/types/Mutation/*`],
  }),
);

// Add DynamoDB Stream trigger for AgentJob table
// Lambda will process new PENDING jobs automatically
backend.taskAgents.resources.lambda.addEventSource(
  new DynamoEventSource(agentJobTable, {
    startingPosition: StartingPosition.LATEST,
    batchSize: 1, // Process one job at a time
    retryAttempts: 2,
  })
);
