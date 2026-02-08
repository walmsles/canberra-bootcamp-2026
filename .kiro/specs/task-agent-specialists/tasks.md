# Implementation Plan: Task Agent Specialists

## Overview

Add four specialized AI agents by creating new SOP files (including an orchestrator), regenerating the SOP bundle, updating the handler to pass query context, adding a response validator, and wiring up GraphQL custom queries. The `@serverless-dna/sop-agents` framework handles routing via the orchestrator SOP — no custom router module needed. The `create_tasks` batch tool (from the `batch-create-tasks` feature) is already implemented and registered in the handler, and the `project-breakdown.md` SOP already uses it.

## Tasks

- [x] 1. Create SOP files
  - [x] 1.1 Create `amplify/functions/task-agents/sops/orchestrator.md`
    - Use `type: orchestrator` in frontmatter, no tools listed
    - Include routing rules that delegate to specialist agents by name based on queryType in the prompt
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Create `amplify/functions/task-agents/sops/project-breakdown.md`
    - Use `type: agent` with tools: `create_tasks`, `get_lists` (uses the batch `create_tasks` tool from the `batch-create-tasks` feature instead of `create_task`)
    - Instruct agent to collect all tasks into a single array and call `create_tasks` once with the `listId` and full tasks array
    - Instruct agent to verify target list via `get_lists`, decompose brief into tasks scoped to ≤90 min each
    - Instruct agent to assign priorities, due dates (backward from deadline), tags, effort estimates
    - Define JSON output format: `projectName`, `totalTasks`, `estimatedTotalHours`, `workStreams`, `criticalPath`, `projectDuration`, `summary`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 1.3 Create `amplify/functions/task-agents/sops/task-analyzer.md`
    - Use `type: agent` with no tools (pure analysis)
    - Instruct agent to extract priority, estimated minutes, due date, tags, reasoning from description
    - Instruct agent to resolve temporal references using enriched timestamp context
    - Instruct agent to return `null` for dueDate when no temporal references present
    - Define JSON output format: `priority`, `estimatedMinutes`, `dueDate`, `tags`, `reasoning`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.4 Create `amplify/functions/task-agents/sops/daily-planner.md`
    - Use `type: agent` with tools: `get_tasks`
    - Instruct agent to fetch incomplete tasks, prioritize overdue/due-today
    - Instruct agent to apply energy management (high-focus AM, lighter PM), limit to 8 hours
    - Instruct agent to place excess tasks in `unscheduledTasks`
    - Define JSON output format: `schedule` (array of `startTime`, `endTime`, `taskId`, `taskName`, `reasoning`), `unscheduledTasks`, `summary`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 1.5 Create `amplify/functions/task-agents/sops/task-recommender.md`
    - Use `type: agent` with tools: `get_tasks`
    - Instruct agent to fetch incomplete tasks, apply Eisenhower Matrix scoring
    - Instruct agent to consider time of day for energy-level appropriateness
    - Instruct agent to recommend ONE task with justification and 1-2 alternatives
    - Define JSON output format: `recommendedTaskId`, `taskName`, `reasoning`, `alternatives`, `estimatedCompletion`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 2. Regenerate SOP bundle
  - [x] 2.1 Run `bundle-sops.ts` to regenerate `sops-bundle.ts` with all 6 SOPs
    - Verify the generated bundle exports `orchestrator`, `project_breakdown`, `task_analyzer`, `daily_planner`, `task_recommender`, and `task_management`
    - Verify `allSops` record contains all 6 entries
    - Note: The SOP bundle was regenerated after `project-breakdown.md` was updated to use `create_tasks` (from `batch-create-tasks` feature)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 3. Create response validator and update handler
  - [x] 3.1 Create `amplify/functions/task-agents/validate-response.ts`
    - Define `AgentResponse` interface with `success`, `data`, `error`, `rawResponse` fields
    - Implement `validateAgentResponse(raw: string): AgentResponse`
    - Attempt `JSON.parse`; on success return `{ success: true, data: parsed }`
    - On failure return `{ success: false, error: 'Invalid JSON response', rawResponse: raw }`
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 3.2 Write property tests for response validator in `amplify/functions/task-agents/__tests__/validate-response.test.ts`
    - **Property 1: Valid JSON responses parse successfully**
    - **Validates: Requirements 9.1, 9.3**
    - **Property 2: Invalid JSON responses return structured errors**
    - **Validates: Requirements 9.2, 9.3**
    - Include unit tests for empty string, plain text, partial JSON, nested objects

  - [x] 3.3 Update `amplify/functions/task-agents/handler.ts`
    - Import `validateAgentResponse` from `./validate-response.js`
    - Import `createTasks` from `./tools/create-tasks.js` and register `createTasksTool` with name `create_tasks` (already done via `batch-create-tasks` feature)
    - Register all 4 tools in the orchestrator: `create_task`, `create_tasks`, `get_tasks`, `get_lists`
    - Update event type to accept both legacy `{ query: string }` and new `{ queryType: string; [key: string]: unknown }` shapes
    - When `queryType` is present, build prompt with queryType and arguments alongside enriched timestamp context
    - When `queryType` is absent, preserve existing behavior (enrichQuery on `query` field)
    - Validate response with `validateAgentResponse` and return JSON string
    - Log warning for unrecognized `queryType` values
    - _Requirements: 1.1, 1.6, 1.7, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_

  - [x] 3.4 Update `amplify/functions/task-agents/resource.ts` to increase timeout
    - Increase `timeoutSeconds` from 60 to 120 for Project Breakdown agent (multiple tool calls)
    - _Requirements: 3.2_

- [x] 4. Add GraphQL custom queries
  - [x] 4.1 Update `amplify/data/resource.ts` with four new custom queries
    - Add `breakdownProject` query: `listId` (required), `projectBrief` (required), `deadline` (optional), returns string
    - Add `analyzeTask` query: `taskDescription` (required), returns string
    - Add `planDay` query: `date` (required), `listId` (optional), returns string
    - Add `recommendTask` query: `listId` (optional), returns string
    - All queries use `allow.authenticated()` authorization
    - All queries use `a.handler.function(taskAgents)` handler
    - Import `taskAgents` from the function resource
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 5. Final checkpoint - Ensure lint and tests pass
  - Run `npm run lint` and `npm run test`
  - Ensure all tests pass with no warnings or errors, ask the user if questions arise.
