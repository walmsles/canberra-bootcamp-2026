import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { acceptInvitation } from './functions/accept-invitation/resource';

const backend = defineBackend({
  auth,
  data,
  acceptInvitation,
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
