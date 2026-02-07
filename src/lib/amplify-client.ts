import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

type AmplifyClient = ReturnType<typeof generateClient<Schema>>;

let cachedClient: AmplifyClient | null = null;

export function getClient(): AmplifyClient {
  if (!cachedClient) {
    cachedClient = generateClient<Schema>({
      authMode: 'userPool',
    });
  }
  return cachedClient;
}

// For backwards compatibility during migration
export const client = {
  get models() {
    return getClient().models;
  },
};
