# Implementation Plan: AI Todo Assistant

## Overview

Frontend integration of four AI agent capabilities into the existing todo app. The backend queries already exist — this plan covers the response parser, React hooks, UI components (all shadcn), and wiring into existing views. Each task builds incrementally: parser first, then hooks, then UI components, then integration.

## Tasks

- [-] 1. Create AI response parser and types
  - [x] 1.1 Create `src/lib/ai-response-parser.ts` with TypeScript interfaces for all agent response types (TaskAnalysis, ProjectBreakdownResult, DailyPlanResult, TaskRecommendation), the ParseResult discriminated union, parse functions for each agent type with JSON parsing and field validation, the prettyPrint function, and the mapAnalyzerPriority helper
    - Implement `parseTaskAnalysis`, `parseProjectBreakdown`, `parseDailyPlan`, `parseTaskRecommendation`
    - Each parse function: try JSON.parse, validate required fields, return `ParseResult<T>`
    - Implement `prettyPrint` using `JSON.stringify` with formatting
    - Implement `mapAnalyzerPriority` mapping `high/medium/low` to `HIGH/MEDIUM/LOW`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 1.6_

  - [ ]* 1.2 Write property test: Priority mapping correctness
    - **Property 1: Priority mapping correctness**
    - **Validates: Requirements 1.6**

  - [ ]* 1.3 Write property test: Valid JSON parsing produces typed objects
    - **Property 2: Valid JSON parsing produces typed objects**
    - **Validates: Requirements 6.1**

  - [ ]* 1.4 Write property test: Invalid JSON returns parse error
    - **Property 3: Invalid JSON returns parse error**
    - **Validates: Requirements 6.2**

  - [ ]* 1.5 Write property test: Missing required fields returns validation error
    - **Property 4: Missing required fields returns validation error**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]* 1.6 Write property test: Parse/prettyPrint round-trip
    - **Property 5: Parse/prettyPrint round-trip**
    - **Validates: Requirements 6.6**

- [x] 2. Checkpoint - Parser tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create AI agent hooks
  - [x] 3.1 Create `src/hooks/use-ai-agents.ts` with hooks for all four agent queries: `useAnalyzeTask`, `useBreakdownProject`, `usePlanDay`, `useRecommendTask`
    - Each hook uses TanStack Query `useMutation` wrapping the corresponding `client.queries.*` call
    - Each hook calls the appropriate parse function from `ai-response-parser.ts`
    - Each hook exposes: action function, `data`, `isLoading`, `error`, `reset`
    - Prevent duplicate invocations by checking `isPending` before calling `mutateAsync`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 4. Add priority field and AI assist to AddTodoForm
  - [x] 4.1 Update `src/components/todo/AddTodoForm.tsx` to add a priority Select field (shadcn Select with LOW/MEDIUM/HIGH/URGENT options), an AI assist button (wand icon) that calls `useAnalyzeTask`, and pre-fill logic that maps the analyzer response to form fields
    - Extend `onAdd` callback to accept optional `priority` parameter
    - Add priority state, AI loading state, and error display
    - When AI returns, pre-fill priority (mapped), tags, dueDate; keep title as user typed it
    - Show error message on parse failure, preserve user input
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 4.2 Update `src/routes/lists.$listId.tsx` and `src/components/layout/AppLayout.tsx` to pass the new `priority` parameter from `AddTodoForm.onAdd` through to `createTodo.mutate`
    - _Requirements: 1.2_

- [ ] 5. Checkpoint - NLP todo creation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Create Project Breakdown dialog
  - [ ] 6.1 Create `src/components/ai/ProjectBreakdownDialog.tsx` using shadcn Dialog with inputs for project brief and optional deadline, loading state, results view with task list and confirm button
    - Use `useBreakdownProject` hook
    - Display generated tasks in a list with checkboxes for selection
    - On confirm, call `useCreateTodo` for each selected task
    - Show error message with retry on failure
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 6.2 Add project breakdown action button to `src/components/list/ListCard.tsx` that opens the ProjectBreakdownDialog
    - Add a brain/sparkles icon button to the ListCard header actions
    - Pass `listId` to the dialog
    - _Requirements: 2.1_

- [ ] 7. Create Dashboard AI cards
  - [ ] 7.1 Create `src/components/ai/DailyPlanCard.tsx` using shadcn Card with a "Plan My Day" button, optional list filter Select, loading Skeleton, and prioritized task list display
    - Use `usePlanDay` hook
    - Only fetch when user clicks the button (not on mount)
    - Show error with retry on failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 7.2 Create `src/components/ai/TaskRecommendationCard.tsx` using shadcn Card with a "What Should I Do Next?" button, optional list filter Select, loading Skeleton, and recommendation display with reasoning
    - Use `useRecommendTask` hook
    - Only fetch when user clicks the button (not on mount)
    - Show error with retry on failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 7.3 Integrate DailyPlanCard and TaskRecommendationCard into the Dashboard by updating `src/components/layout/AppLayout.tsx` to render the AI cards above the todo list area
    - Pass available lists for the optional list filter
    - _Requirements: 3.1, 3.5, 4.1, 4.5_

- [ ] 8. Final checkpoint
  - Ensure all tests pass and linting passes (`npm run lint`, `npm run test`), ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All UI components use shadcn primitives — no custom component creation
- The backend queries already exist; no backend changes needed
- Property tests use `fast-check` with minimum 100 iterations per test
- Each property test references its design document property number
