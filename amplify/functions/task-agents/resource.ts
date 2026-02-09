import { defineFunction } from '@aws-amplify/backend';

export const taskAgents = defineFunction({
  name: 'task-agents',
  entry: './async-handler.ts',
  timeoutSeconds: 900, // 15 minutes
  resourceGroupName: 'data',
});
