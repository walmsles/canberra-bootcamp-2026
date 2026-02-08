# Implementation Plan: Batch Create Tasks

## Overview

Add a `create_tasks` batch tool that uses DynamoDB `BatchWriteItem` to create multiple tasks in one call, register it in the handler, and update the Project Breakdown SOP to use it. The existing `create_task` tool remains unchanged.

## Tasks

- [-] 1. Implement the batch create tasks tool
  - [x] 1.1 Create `amplify/functions/task-agents/tools/create-tasks.ts`
    - Import `buildCreateTaskItem` from `./create-task.js`
    - Import `BatchWriteCommand` from `@aws-sdk/lib-dynamodb`
    - Define `CreateTasksInput` interface with `listId: string` and `tasks: Array<CreateTaskInput>`
    - Define `CreateTasksResult` interface with `success`, `createdCount`, `items?`, `errors?`, `error?`
    - Implement `createTasks(input, docClient, tableName, owner)`:
      - Return error if `tasks` array is empty or `listId` is missing
      - Validate all tasks by calling `buildCreateTaskItem({ ...task, listId }, owner)` for each
      - If any validation fails, return `success: false` with all error messages, no writes
      - Chunk validated items into groups of 25
      - For each chunk, call `BatchWriteCommand`
      - If `UnprocessedItems` returned, retry with exponential backoff (100ms, 200ms, 400ms) up to 3 attempts
      - On full success, return `success: true`, `createdCount`, and `items` array
      - On DynamoDB failure, return error with count of items written before failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.2_

  - [ ]* 1.2 Write property tests for batch tool in `amplify/functions/task-agents/__tests__/create-tasks.test.ts`
    - **Property 1: Item construction consistency**
    - **Validates: Requirements 1.1, 4.2**
    - **Property 2: Correct chunking**
    - **Validates: Requirements 1.2, 1.3**
    - **Property 3: All-or-nothing validation**
    - **Validates: Requirements 1.5**
    - **Property 4: Success response count matches input**
    - **Validates: Requirements 1.6**

  - [ ]* 1.3 Write unit tests for retry and error scenarios in `amplify/functions/task-agents/__tests__/create-tasks.test.ts`
    - Test retry behavior when DynamoDB returns UnprocessedItems (mock)
    - Test DynamoDB failure mid-batch returns partial success count (mock)
    - Test empty array input returns error
    - _Requirements: 1.4, 1.7_

- [x] 2. Register batch tool in handler and update SOP
  - [x] 2.1 Update `amplify/functions/task-agents/handler.ts`
    - Import `createTasks` from `./tools/create-tasks.js`
    - Create `createTasksTool` FunctionTool with name `create_tasks`, input schema accepting `listId` (required string) and `tasks` (required array of task objects)
    - Add `create_tasks: createTasksTool` to the orchestrator tools map
    - Keep all existing tool registrations unchanged
    - _Requirements: 2.1, 2.2, 2.3, 4.1_

  - [x] 2.2 Update `amplify/functions/task-agents/sops/project-breakdown.md`
    - Replace `create_task` with `create_tasks` in the tools frontmatter
    - Keep `get_lists` in the tools frontmatter
    - Update Step 4 to instruct the agent to collect all decomposed tasks into an array, then call `create_tasks` once with the `listId` and the full tasks array
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.3 Regenerate SOP bundle by running `npx tsx amplify/functions/task-agents/bundle-sops.ts`
    - Verify the updated `project-breakdown.md` is included in the regenerated bundle
    - _Requirements: 3.1_

- [x] 3. Final checkpoint
  - Run `npm run lint` and `npm run test`
  - Ensure all tests pass with no warnings or errors, ask the user if questions arise.
