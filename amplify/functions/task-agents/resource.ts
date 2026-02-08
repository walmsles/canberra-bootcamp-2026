import { defineFunction } from '@aws-amplify/backend';

export const taskAgents = defineFunction({
  name: 'task-agents',
  entry: './handler.ts',
  timeoutSeconds: 60,
  resourceGroupName: 'data',
});
