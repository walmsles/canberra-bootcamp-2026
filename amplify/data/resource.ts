import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

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
    groupId: a.id(), // Optional: if shared with a group
    group: a.belongsTo('ListGroup', 'groupId'),
    todos: a.hasMany('TodoItem', 'listId'),
  }).authorization(allow => [
    allow.owner().identityClaim('sub'),
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
    listId: a.id().required(),
    list: a.belongsTo('TodoList', 'listId'),
  }).authorization(allow => [
    allow.owner().identityClaim('sub'),
  ]).secondaryIndexes(index => [
    index('listId').sortKeys(['dueDate']).name('byList'),
    index('status').sortKeys(['dueDate']).name('byStatus'),
  ]),

  // List Group for sharing
  // Requirements: 7.1, 7.2, 10.3
  ListGroup: a.model({
    name: a.string().required(),
    description: a.string(),
    memberIds: a.string().array(), // Array of user IDs
    lists: a.hasMany('TodoList', 'groupId'),
  }).authorization(allow => [
    allow.owner().identityClaim('sub'),
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
  ]).secondaryIndexes(index => [
    index('invitedEmail').name('byEmail'),
    index('groupId').name('byGroup'),
  ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
