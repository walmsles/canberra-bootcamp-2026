import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: 'Welcome to Todo App - Verify your email',
      verificationEmailBody: (createCode: () => string) => 
        `Your verification code is: ${createCode()}`,
    },
  },
  userAttributes: {
    preferredUsername: {
      required: false,
      mutable: true,
    },
  },
  // Password requirements: min 8 chars, uppercase, lowercase, numbers
  // These are enforced by Cognito's default policy
  accountRecovery: 'EMAIL_ONLY',
});
