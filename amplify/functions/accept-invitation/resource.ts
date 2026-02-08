import { defineFunction } from '@aws-amplify/backend';

export const acceptInvitation = defineFunction({
  name: 'accept-invitation',
  entry: './handler.ts',
  resourceGroupName: 'data', // Assign to data stack to avoid circular dependency
});
