import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
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

todoItemTable.grantReadWriteData(backend.taskAgents.resources.lambda);
todoListTable.grantReadData(backend.taskAgents.resources.lambda);

backend.taskAgents.addEnvironment('TODOITEM_TABLE_NAME', todoItemTable.tableName);
backend.taskAgents.addEnvironment('TODOLIST_TABLE_NAME', todoListTable.tableName);

// Grant Bedrock permissions for Claude models
backend.taskAgents.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: ['arn:aws:bedrock:*::foundation-model/anthropic.claude-*'],
  }),
);
