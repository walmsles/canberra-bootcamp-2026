
# Implementation Plan: Todo App

## Overview

This implementation plan follows a progressive approach to build a working todo app demo as quickly as possible, then layer on advanced features. The plan is organized into phases:

1. **Phase 1 (MVP)**: Project setup, authentication, basic todo CRUD
2. **Phase 2**: Lists organization and management
3. **Phase 3**: Groups and sharing functionality
4. **Phase 4**: Tags, reminders, and polish

## Tasks

- [x] 1. Project Setup and Infrastructure
  - [x] 1.1 Initialize React project with Vite and configure TailwindCSS
    - Create new Vite React TypeScript project
    - Install and configure TailwindCSS
    - Install shadcn/ui and initialize with default config
    - _Requirements: 9.4_

  - [x] 1.2 Set up TanStack Router with file-based routing
    - Install @tanstack/react-router and related packages
    - Configure Vite plugin for file-based route generation
    - Create route tree structure in src/routes/
    - _Requirements: 9.1_

  - [x] 1.3 Set up TanStack Query
    - Install @tanstack/react-query
    - Create QueryClient with default options in src/lib/query-client.ts
    - Wrap app with QueryClientProvider in root route
    - _Requirements: 9.2, 9.3_

  - [x] 1.4 Initialize Amplify Gen 2 backend
    - Run amplify init to create amplify/ directory structure
    - Configure amplify/backend.ts with auth and data
    - Set up amplify/auth/resource.ts with email login
    - _Requirements: 10.1, 10.2_

- [x] 2. Authentication Implementation
  - [x] 2.1 Create Amplify auth resource with email/password login
    - Define auth configuration in amplify/auth/resource.ts
    - Configure password requirements and email verification
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Create authentication pages and components
    - Create /login route with login form using shadcn/ui
    - Create /signup route with signup form
    - Implement form validation for email and password
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.3 Implement auth state management and protected routes
    - Create useAuth hook using Amplify Auth
    - Create AuthGuard component for protected routes
    - Implement logout functionality
    - _Requirements: 1.6, 1.7_

  - [ ]* 2.4 Write property test for email validation
    - **Property 4: Invalid Email Validation**
    - **Validates: Requirements 1.2**

- [x] 3. Checkpoint - Authentication Working
  - Ensure authentication flow works end-to-end
  - Verify signup, login, logout, and session persistence
  - Ask the user if questions arise

- [x] 4. Basic Todo CRUD (MVP Core)
  - [x] 4.1 Create Amplify data schema for TodoItem
    - Define TodoItem model in amplify/data/resource.ts
    - Configure owner-based authorization
    - Add secondary indexes for queries
    - _Requirements: 3.1, 10.2, 10.3_

  - [x] 4.2 Create Amplify client and type-safe data hooks
    - Create src/lib/amplify-client.ts with generateClient
    - Create src/hooks/use-todos.ts with useQuery/useMutation hooks
    - Implement CRUD operations: create, list, update, delete
    - _Requirements: 3.1, 3.3, 3.5, 3.6, 9.2_

  - [x] 4.3 Create todo list UI components
    - Create TodoItem component with checkbox, title, actions
    - Create TodoList component to display items
    - Create AddTodoForm component with validation
    - _Requirements: 3.1, 3.2, 9.4, 9.5, 9.6_

  - [x] 4.4 Create dashboard page with todo management
    - Create /dashboard route as main authenticated view
    - Wire up todo components with data hooks
    - Implement loading and error states
    - _Requirements: 3.6, 9.5, 9.6_

  - [x] 4.5 Implement todo status management
    - Add status field to TodoItem (PENDING, IN_PROGRESS, COMPLETE)
    - Create status toggle/dropdown in TodoItem component
    - Set completedAt timestamp when marking complete
    - _Requirements: 3.4, 4.1, 4.2, 4.3_

  - [ ]* 4.6 Write property test for todo CRUD round-trip
    - **Property 1: Todo Item CRUD Round-Trip**
    - **Validates: Requirements 3.1, 3.3, 3.6**

  - [ ]* 4.7 Write property test for empty input validation
    - **Property 3: Empty Input Validation**
    - **Validates: Requirements 2.2, 3.2**

  - [ ]* 4.8 Write property test for status transitions
    - **Property 5: Status Transition with Timestamp**
    - **Validates: Requirements 3.4, 4.1, 4.2, 4.3**

- [x] 5. Checkpoint - Basic Todo App Working
  - Ensure todo CRUD operations work correctly
  - Verify status changes and timestamps
  - Test error handling for invalid inputs
  - Ask the user if questions arise

- [x] 6. Todo Lists Organization
  - [x] 6.1 Add TodoList model to Amplify schema
    - Define TodoList model with name, description, ownerId
    - Add relationship: TodoList hasMany TodoItem
    - Configure owner-based authorization
    - _Requirements: 2.1, 2.6, 10.3_

  - [x] 6.2 Create list management hooks
    - Create src/hooks/use-lists.ts with CRUD hooks
    - Update use-todos.ts to filter by listId
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 6.3 Create list management UI
    - Create ListCard component for list display
    - Create ListsPage (/lists route) showing all user lists
    - Create AddListForm component
    - Create ListDetailPage (/lists/$listId route)
    - _Requirements: 2.1, 2.3, 9.4_

  - [x] 6.4 Implement list deletion with cascade
    - Add delete functionality to list management
    - Ensure all todos in list are deleted
    - _Requirements: 2.5_

  - [ ]* 6.5 Write property test for list CRUD round-trip
    - **Property 2: TodoList CRUD Round-Trip**
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [ ]* 6.6 Write property test for cascade delete
    - **Property 10: List Cascade Delete**
    - **Validates: Requirements 2.5**

- [x] 7. Checkpoint - Lists Working
  - Ensure list CRUD operations work
  - Verify cascade delete removes all todos
  - Ask the user if questions arise

- [x] 8. Tags Implementation
  - [x] 8.1 Add tags field to TodoItem schema
    - Update TodoItem model with tags array field
    - _Requirements: 5.1, 5.5_

  - [x] 8.2 Create tag input and display components
    - Create TagInput component for adding/removing tags
    - Create TagBadge component for display
    - Update TodoItem component to show tags
    - _Requirements: 5.1, 5.4_

  - [x] 8.3 Implement tag filtering and sorting
    - Add filter by tag functionality to todo list
    - Add sort by tag option
    - _Requirements: 5.2, 5.3_

  - [ ]* 8.4 Write property test for tag filtering
    - **Property 8: Tag Filtering**
    - **Validates: Requirements 5.2**

  - [ ]* 8.5 Write property test for tag sorting
    - **Property 9: Tag Sorting**
    - **Validates: Requirements 5.3**

  - [ ]* 8.6 Write property test for tags cardinality
    - **Property 13: Tags Cardinality**
    - **Validates: Requirements 5.1, 5.4, 5.5**

- [x] 9. Reminders Implementation
  - [x] 9.1 Add reminder fields to TodoItem schema
    - Add reminderMinutes and reminderSent fields
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.2 Create ReminderService for browser notifications
    - Implement src/services/reminder-service.ts
    - Add notification permission request
    - Implement reminder scheduling logic
    - _Requirements: 6.1, 6.4_

  - [x] 9.3 Create reminder configuration UI
    - Add reminder time selector to todo form
    - Create UserSettings model for default reminder time
    - Create settings page for user preferences
    - _Requirements: 6.2, 6.3_

  - [x] 9.4 Implement reminder lifecycle management
    - Cancel reminders when todo is completed
    - Reschedule reminders when due date changes
    - _Requirements: 6.5, 6.6_

  - [ ]* 9.5 Write property test for reminder scheduling
    - **Property 6: Reminder Scheduling Logic**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.5, 6.6**

- [x] 10. Checkpoint - Tags and Reminders Working
  - Ensure tags can be added, filtered, and sorted
  - Verify reminders fire at correct times
  - Test reminder cancellation on completion
  - Ask the user if questions arise

- [x] 11. List Groups and Sharing
  - [x] 11.1 Add ListGroup and GroupInvitation models to schema
    - Define ListGroup model with owner and memberIds
    - Define GroupInvitation model for invite flow
    - Configure authorization rules for group access
    - _Requirements: 7.1, 7.2, 10.3_

  - [x] 11.2 Create group management hooks
    - Create src/hooks/use-groups.ts with CRUD hooks
    - Implement invite and revoke member functions
    - _Requirements: 7.1, 7.2, 7.3, 7.6_

  - [x] 11.3 Create group management UI
    - Create GroupsPage (/groups route)
    - Create GroupDetailPage (/groups/$groupId route)
    - Create InviteMemberDialog component
    - Create MemberList component with revoke action
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 11.4 Implement list sharing within groups
    - Add groupId field to TodoList for sharing
    - Update list queries to include shared lists
    - Update authorization to allow member access
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 11.5 Write property test for authorization enforcement
    - **Property 7: Authorization Enforcement**
    - **Validates: Requirements 7.4, 8.5, 10.3**

  - [ ]* 11.6 Write property test for group membership management
    - **Property 11: Group Membership Management**
    - **Validates: Requirements 7.2, 7.3, 7.5, 8.1, 8.2, 8.3**

  - [ ]* 11.7 Write property test for group owner privileges
    - **Property 12: Group Owner Privileges**
    - **Validates: Requirements 7.4, 7.6, 8.5**

- [x] 12. Final Polish and Error Handling
  - [x] 12.1 Implement comprehensive error handling
    - Create ErrorBoundary component
    - Add toast notifications for errors
    - Implement retry logic for failed requests
    - _Requirements: 9.6, 10.5_

  - [x] 12.2 Add loading states and optimistic updates
    - Add skeleton loaders for lists and todos
    - Implement optimistic updates for better UX
    - _Requirements: 9.5_

  - [x] 12.3 Ensure responsive design
    - Test and fix mobile layouts
    - Add responsive navigation
    - _Requirements: 9.7_

- [x] 13. Final Checkpoint
  - Ensure all tests pass
  - Verify all features work end-to-end
  - Test on mobile and desktop
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Phase 1-2 (tasks 1-7) deliver a working personal todo app
- Phase 3-4 (tasks 8-13) add collaboration and advanced features
