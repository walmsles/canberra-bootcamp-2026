import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { acceptInvitation } from '../functions/accept-invitation/resource';

const schema = a.schema({
  // User preferences and settings
  UserSettings: a.model({
    userId: a.id().required(),
    defaultReminderMinutes: a.integer().default(1440), // 24 hours
    timezone: a.string().default('UTC'),
  }).authorization(allow => [allow.owner().identityClaim('sub')]),

  // Todo List model
  TodoList: a.model({
    name: a.string().required(),
    description: a.string(),
    sortOrder: a.integer().default(0), // For drag-and-drop ordering
    groupId: a.id(), // Optional: if shared with a group
    group: a.belongsTo('ListGroup', 'groupId'),
    todos: a.hasMany('TodoItem', 'listId'),
  }).authorization(allow => [
    allow.owner().identityClaim('sub'),
    allow.authenticated().to(['read', 'update', 'delete']), // Allow owner to update groupId and members to read/delete
  ]).secondaryIndexes(index => [
    index('groupId').sortKeys(['name']).name('byGroup'),
  ]),

  // Todo Item model
  TodoItem: a.model({
    title: a.string().required(),
    description: a.string(),
    status: a.enum(['PENDING', 'IN_PROGRESS', 'COMPLETE']),
    dueDate: a.datetime(),
    completedAt: a.datetime(),
    tags: a.string().array(),
    reminderMinutes: a.integer(), // Minutes before due date
    reminderSent: a.boolean().default(false),
    priority: a.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    effortHours: a.float(),
    listId: a.id().required(),
    list: a.belongsTo('TodoList', 'listId'),
  }).authorization(allow => [
    allow.authenticated().to(['read', 'create', 'update', 'delete']), // Allow all authenticated users first
    allow.owner().identityClaim('sub'), // Then allow owner-specific access
  ]).secondaryIndexes(index => [
    index('listId').sortKeys(['dueDate']).name('byList'),
    index('status').sortKeys(['dueDate']).name('byStatus'),
  ]),

  // List Group for sharing
  // Requirements: 7.1, 7.2, 10.3
  ListGroup: a.model({
    name: a.string().required(),
    description: a.string(),
    ownerEmail: a.string(), // Owner's email for display
    memberIds: a.string().array(), // Array of user IDs (sub claims)
    memberEmails: a.string().array(), // Array of member emails for display
    lists: a.hasMany('TodoList', 'groupId'),
  }).authorization(allow => [
    allow.owner().identityClaim('sub'),
    allow.authenticated().to(['read', 'update']), // Allow reading for invitation acceptance and updating to join
  ]),

  // Group Invitation
  // Requirements: 7.2, 10.3
  GroupInvitation: a.model({
    groupId: a.id().required(),
    groupName: a.string().required(),
    invitedEmail: a.string().required(),
    invitedUserId: a.id(),
    status: a.enum(['PENDING', 'ACCEPTED', 'DECLINED']),
    invitedBy: a.id().required(),
  }).authorization(allow => [
    allow.owner().identityClaim('sub'),
    allow.authenticated().to(['read', 'update']), // Allow invitees to read and accept/decline
  ]).secondaryIndexes(index => [
    index('invitedEmail').name('byEmail'),
    index('groupId').name('byGroup'),
  ]),

  // AI Agent Job for async processing
  // Frontend creates job with PENDING status, subscribes to updates
  // Lambda picks up job, processes it, updates status to COMPLETE/FAILED
  AgentJob: a.model({
    queryType: a.string().required(),
    status: a.enum(['PENDING', 'PROCESSING', 'COMPLETE', 'FAILED']),
    requestData: a.json(), // Store the request parameters
    resultData: a.json(), // Store the AI response
    error: a.string(),
    startedAt: a.datetime(),
    completedAt: a.datetime(),
  }).authorization(allow => [
    allow.owner().identityClaim('sub'),
  ]),

  // Custom mutation for atomically accepting invitations
  // Avoids race condition when multiple users accept simultaneously
  acceptGroupInvitation: a
    .mutation()
    .arguments({
      invitationId: a.string().required(),
      groupId: a.string().required(),
      userId: a.string().required(),
      userEmail: a.string().required(),
    })
    .returns(a.customType({
      success: a.boolean().required(),
      message: a.string().required(),
      groupId: a.string(),
    }))
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(acceptInvitation)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
