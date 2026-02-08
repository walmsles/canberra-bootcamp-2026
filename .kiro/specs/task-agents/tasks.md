# Implementation Plan: Task Agents

## Overview

Implement the `task-agents` Lambda function using `@serverless-dna/sop-agents`, following the existing Amplify Gen2 function pattern. Build tools incrementally, wire into the backend, and validate with property-based and unit tests.

## Tasks

- [x] 1. Scaffold the task-agents function and extend schema
  - [x] 1.1 Add `priority` (enum: LOW, MEDIUM, HIGH, URGENT) and `effortHours` (float) fields to the TodoItem model in `amplify/data/resource.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 1.2 Create `amplify/functions/task-agents/resource.ts` with `defineFunction` config (name: `task-agents`, entry: `./handler.ts`, timeoutSeconds: 60, resourceGroupName: `data`)
    - _Requirements: 1.1, 1.2_
  - [x] 1.3 Create `amplify/functions/task-agents/package.json` with dependencies: `@serverless-dna/sop-agents`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-lambda-powertools/logger`, `uuid`
    - _Requirements: 2.1_
  - [x] 1.4 Create `amplify/functions/task-agents/sops/` directory with a placeholder SOP file
    - _Requirements: 6.1, 6.2_
  - [x] 1.5 Create stub `amplify/functions/task-agents/handler.ts` that initializes the orchestrator, enriches the query with timestamp context, and returns `orchestrator.invoke()` result
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [-] 2. Implement tool modules
  - [x] 2.1 Create `amplify/functions/task-agents/tools/create-task.ts` — validates required fields (title, listId), strips unknown fields with warning log, supports priority and effortHours, builds DynamoDB PutItem, returns created item
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.1, 7.3, 8.1, 8.2_
  - [ ]* 2.2 Write property tests for create_task tool
    - **Property 2: create_task round trip**
    - **Property 3: create_task rejects missing required fields**
    - **Property 6: Unknown fields are stripped from create_task**
    - **Validates: Requirements 3.2, 3.3, 3.4, 7.1, 7.3**
  - [x] 2.3 Create `amplify/functions/task-agents/tools/get-tasks.ts` — accepts optional filters (listId, status, dueDate range), uses appropriate GSI, ignores unknown filter fields, returns matching items
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.2_
  - [ ]* 2.4 Write property tests for get_tasks tool
    - **Property 4: get_tasks filter correctness**
    - **Property 7: get_tasks ignores unknown filter fields**
    - **Validates: Requirements 4.3, 4.4, 7.2**
  - [x] 2.5 Create `amplify/functions/task-agents/tools/get-lists.ts` — scans TodoList table, returns id, name, description for each list
    - _Requirements: 5.1, 5.2_
  - [ ]* 2.6 Write property tests for get_lists tool
    - **Property 5: get_lists returns id and name**
    - **Validates: Requirements 5.2**

- [x] 3. Implement query enrichment and handler wiring
  - [x] 3.1 Extract query enrichment into a testable function in `amplify/functions/task-agents/enrich-query.ts` and wire it into the handler
    - _Requirements: 2.4, 2.5, 2.6_
  - [ ]* 3.2 Write property test for query enrichment
    - **Property 1: Query enrichment produces correct format**
    - **Validates: Requirements 2.4, 2.5**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Wire function into Amplify backend
  - [ ] 5.1 Update `amplify/backend.ts` to import and register `taskAgents`, grant DynamoDB table access (read-write for TodoItem, read for TodoList), pass table names as env vars, and add Bedrock IAM policy
    - _Requirements: 1.3, 1.4, 1.5, 1.6_
  - [ ] 5.2 Register the handler tools with the orchestrator in `handler.ts` — import all three tool modules and pass them to the orchestrator initialization
    - _Requirements: 3.1, 4.1, 5.1_

- [ ] 6. Final checkpoint - Ensure all tests pass and linting is clean
  - Run `npm run lint` and `npm run test`, fix all errors and warnings.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The function follows the same pattern as `accept-invitation` (defineFunction, DynamoDB SDK, env vars for table names)
- Property tests use `fast-check` with minimum 100 iterations
- The `./sops/` directory must be packaged with the Lambda — if esbuild bundling doesn't include it automatically, a CDK construct override or alternative approach will be needed during task 1.3
