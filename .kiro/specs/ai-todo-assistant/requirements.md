# Requirements Document

## Introduction

This feature integrates AI capabilities into the existing todo application through four user-initiated actions: NLP-powered todo creation, project breakdown, daily planning, and task recommendation. The backend infrastructure (Strands agents, Lambda handler, Amplify data schema queries) already exists. This work focuses on frontend UI integration using shadcn components, React hooks for the agent queries, and wiring the AI responses into the existing todo workflows.

## Glossary

- **Task_Analyzer**: The backend AI agent that extracts structured metadata (priority, estimatedMinutes, dueDate, tags, reasoning) from a natural language task description via the `analyzeTask` query.
- **Project_Breakdown_Agent**: The backend AI agent that decomposes a project brief into individual tasks via the `breakdownProject` query.
- **Daily_Planner_Agent**: The backend AI agent that suggests a prioritized list of tasks for a given day via the `planDay` query.
- **Task_Recommender_Agent**: The backend AI agent that suggests the single best task to work on next via the `recommendTask` query.
- **AddTodoForm**: The existing React form component at `src/components/todo/AddTodoForm.tsx` used to create new todo items.
- **Dashboard**: The main application view at `/dashboard` where the user sees their lists and todos.
- **ListCard**: The existing card component representing a todo list, where the project breakdown action is initiated.
- **Agent_Hook**: A custom React hook that wraps an Amplify data schema query to call a backend AI agent and manage loading, error, and result state.
- **AI_Response**: The JSON string returned by a backend agent query, which must be parsed into a structured object on the frontend.

## Requirements

### Requirement 1: NLP Todo Creation

**User Story:** As a user, I want to type a natural language task description and have the AI extract structured metadata to pre-fill the todo form, so that I can create well-organized tasks quickly without manually setting each field.

#### Acceptance Criteria

1. WHEN a user enters a natural language description in the AddTodoForm and triggers the AI assist action, THE AddTodoForm SHALL send the description to the Task_Analyzer via the `analyzeTask` query.
2. WHEN the Task_Analyzer returns a successful AI_Response, THE AddTodoForm SHALL parse the response and pre-fill the form fields (title, priority, tags, dueDate) with the extracted metadata.
3. WHILE the Task_Analyzer is processing a request, THE AddTodoForm SHALL display a loading indicator and disable the AI assist action to prevent duplicate requests.
4. WHEN the Task_Analyzer returns extracted metadata, THE AddTodoForm SHALL allow the user to review and edit all pre-filled fields before submitting the todo.
5. IF the Task_Analyzer returns an error or an unparseable AI_Response, THEN THE AddTodoForm SHALL display an error message and preserve the original user input.
6. WHEN the Task_Analyzer returns a priority value, THE AddTodoForm SHALL map the analyzer priority values (high, medium, low) to the TodoItem priority enum (HIGH, MEDIUM, LOW, URGENT).
7. THE AddTodoForm SHALL include a priority field using a shadcn Select component so the user can view and modify the AI-suggested priority before submission.

### Requirement 2: Project Breakdown

**User Story:** As a user, I want to describe a project on a todo list and have the AI break it into individual tasks, so that I can quickly populate a list with actionable items.

#### Acceptance Criteria

1. WHEN a user initiates the project breakdown action on a ListCard, THE system SHALL display a dialog with inputs for a project brief and an optional deadline.
2. WHEN the user submits the project breakdown dialog, THE system SHALL send the listId, projectBrief, and optional deadline to the Project_Breakdown_Agent via the `breakdownProject` query.
3. WHILE the Project_Breakdown_Agent is processing, THE system SHALL display a loading state in the dialog and disable the submit action.
4. WHEN the Project_Breakdown_Agent returns a successful AI_Response, THE system SHALL parse the response and display the generated tasks for the user to review before adding them to the list.
5. WHEN the user confirms the generated tasks, THE system SHALL add the tasks to the specified todo list and refresh the list view.
6. IF the Project_Breakdown_Agent returns an error or an unparseable AI_Response, THEN THE system SHALL display an error message in the dialog and allow the user to retry.

### Requirement 3: Daily Planning

**User Story:** As a user, I want to click a button on the dashboard and have the AI suggest a prioritized list of tasks to work on today, so that I can plan my day effectively.

#### Acceptance Criteria

1. WHEN a user clicks the daily planning button on the Dashboard, THE Daily_Planner_Agent SHALL receive the current date and an optional listId via the `planDay` query.
2. WHILE the Daily_Planner_Agent is processing, THE Dashboard SHALL display a loading state in the daily plan section.
3. WHEN the Daily_Planner_Agent returns a successful AI_Response, THE Dashboard SHALL parse and display the suggested tasks in a prioritized list format.
4. IF the Daily_Planner_Agent returns an error or an unparseable AI_Response, THEN THE Dashboard SHALL display an error message and allow the user to retry.
5. THE Dashboard SHALL display the daily plan results only when the user explicitly requests the plan to avoid unnecessary AI consumption.

### Requirement 4: Task Recommendation

**User Story:** As a user, I want to click a button on the dashboard and have the AI suggest the best task to tackle next, so that I can focus on the most impactful work.

#### Acceptance Criteria

1. WHEN a user clicks the task recommendation button on the Dashboard, THE Task_Recommender_Agent SHALL receive an optional listId via the `recommendTask` query.
2. WHILE the Task_Recommender_Agent is processing, THE Dashboard SHALL display a loading state in the recommendation section.
3. WHEN the Task_Recommender_Agent returns a successful AI_Response, THE Dashboard SHALL parse and display the recommended task with the agent's reasoning.
4. IF the Task_Recommender_Agent returns an error or an unparseable AI_Response, THEN THE Dashboard SHALL display an error message and allow the user to retry.
5. THE Dashboard SHALL display the task recommendation only when the user explicitly requests the recommendation to avoid unnecessary AI consumption.

### Requirement 5: Agent Hooks

**User Story:** As a developer, I want reusable React hooks that wrap each AI agent query, so that components can call agents with consistent loading, error, and result state management.

#### Acceptance Criteria

1. THE system SHALL provide an Agent_Hook for each agent query (analyzeTask, breakdownProject, planDay, recommendTask) that manages loading, error, and result state.
2. WHEN an Agent_Hook receives a successful response string, THE Agent_Hook SHALL parse the JSON string into a typed object.
3. IF an Agent_Hook receives a response that fails JSON parsing, THEN THE Agent_Hook SHALL set an error state with a descriptive message.
4. WHEN an Agent_Hook is invoked while a previous request is still in progress, THE Agent_Hook SHALL ignore the duplicate invocation.

### Requirement 6: AI Response Parsing

**User Story:** As a developer, I want robust parsing of AI agent responses, so that the frontend handles both valid and malformed responses gracefully.

#### Acceptance Criteria

1. THE AI_Response_Parser SHALL parse a valid JSON string returned by an agent into the expected typed object.
2. IF the AI_Response string is not valid JSON, THEN THE AI_Response_Parser SHALL return a descriptive parse error.
3. THE AI_Response_Parser SHALL validate that parsed objects contain the required fields for each agent type (e.g., Task_Analyzer responses must include priority, estimatedMinutes, tags).
4. IF a parsed AI_Response is missing required fields, THEN THE AI_Response_Parser SHALL return a validation error identifying the missing fields.
5. THE AI_Response_Parser SHALL provide a pretty-print function that formats a parsed AI_Response object back into a JSON string.
6. FOR ALL valid AI_Response objects, parsing the pretty-printed output SHALL produce an object equivalent to the original (round-trip property).
