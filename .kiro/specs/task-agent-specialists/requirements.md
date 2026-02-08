# Requirements Document

## Introduction

This feature extends the existing `task-agents` Lambda function with four specialized AI agents. Each agent is invoked via a dedicated GraphQL custom query that routes to the same Lambda, which selects the appropriate SOP and tool set based on the incoming query type. The agents are: Project Breakdown, Task Analyzer, Daily Planner, and Task Recommender.

## Glossary

- **Lambda_Handler**: The existing AWS Lambda function at `amplify/functions/task-agents/handler.ts` that receives GraphQL query events and orchestrates agent execution
- **SOP**: Standard Operating Procedure — a markdown document that instructs the Bedrock Claude model on how to behave, which tools to use, and what output format to produce
- **Orchestrator**: The `@serverless-dna/sop-agents` `createOrchestrator` instance that loads SOPs and tools, then invokes Bedrock with the user query
- **Router**: Logic within the Lambda_Handler that inspects the incoming event to determine which agent SOP and tool subset to use
- **SOP_Bundle**: The auto-generated TypeScript module (`sops-bundle.ts`) that exports all SOP markdown files as string constants for runtime use
- **Bundle_Script**: The build-time script (`bundle-sops.ts`) that reads SOP markdown files from disk and generates the SOP_Bundle
- **Project_Breakdown_Agent**: A specialized agent that decomposes project briefs into actionable task lists
- **Task_Analyzer_Agent**: A specialized agent that extracts structured metadata from natural language task descriptions without making tool calls
- **Daily_Planner_Agent**: A specialized agent that creates optimized daily schedules from incomplete tasks
- **Task_Recommender_Agent**: A specialized agent that recommends the single best task to work on right now
- **GraphQL_Schema**: The Amplify data schema at `amplify/data/resource.ts` that defines models and custom queries
- **Enriched_Query**: The user query augmented with current date/time context via the `enrichQuery` function

## Requirements

### Requirement 1: Agent Routing

**User Story:** As a developer, I want the Lambda handler to route incoming requests to the correct specialized agent, so that each GraphQL query invokes the appropriate SOP with the right tools.

#### Acceptance Criteria

1. WHEN the Lambda_Handler receives an event with a `queryType` field, THE Router SHALL select the SOP and tool set corresponding to that query type
2. WHEN the Lambda_Handler receives an event with `queryType` set to `breakdownProject`, THE Router SHALL invoke the Project_Breakdown_Agent SOP with `create_task` and `get_lists` tools
3. WHEN the Lambda_Handler receives an event with `queryType` set to `analyzeTask`, THE Router SHALL invoke the Task_Analyzer_Agent SOP with no tools
4. WHEN the Lambda_Handler receives an event with `queryType` set to `planDay`, THE Router SHALL invoke the Daily_Planner_Agent SOP with the `get_tasks` tool
5. WHEN the Lambda_Handler receives an event with `queryType` set to `recommendTask`, THE Router SHALL invoke the Task_Recommender_Agent SOP with the `get_tasks` tool
6. WHEN the Lambda_Handler receives an event without a recognized `queryType`, THE Router SHALL fall back to the existing task-management SOP with all tools
7. IF the Router receives an unknown `queryType` value that is not one of the recognized types and is not absent, THEN THE Lambda_Handler SHALL fall back to the existing task-management SOP with all tools and log a warning

### Requirement 2: GraphQL Custom Queries

**User Story:** As a frontend developer, I want four new GraphQL custom queries registered in the Amplify data schema, so that I can invoke each specialized agent from the client.

#### Acceptance Criteria

1. THE GraphQL_Schema SHALL define a `breakdownProject` custom query accepting `listId` (required string), `projectBrief` (required string), and `deadline` (optional string) arguments, returning a JSON string
2. THE GraphQL_Schema SHALL define an `analyzeTask` custom query accepting `taskDescription` (required string) argument, returning a JSON string
3. THE GraphQL_Schema SHALL define a `planDay` custom query accepting `date` (required string) and `listId` (optional string) arguments, returning a JSON string
4. THE GraphQL_Schema SHALL define a `recommendTask` custom query accepting `listId` (optional string) argument, returning a JSON string
5. WHEN any of the four custom queries is invoked, THE GraphQL_Schema SHALL route the request to the task-agents Lambda function
6. THE GraphQL_Schema SHALL require authenticated access for all four custom queries

### Requirement 3: Project Breakdown Agent SOP

**User Story:** As a user, I want to provide a project brief and have the agent decompose it into actionable tasks, so that I can quickly populate a task list for a new project.

#### Acceptance Criteria

1. WHEN the Project_Breakdown_Agent receives a project brief and list ID, THE Project_Breakdown_Agent SHALL call `get_lists` to verify the target list exists
2. WHEN the Project_Breakdown_Agent processes a project brief, THE Project_Breakdown_Agent SHALL create enough tasks for a detailed breakdown without overloading the user
3. WHEN the Project_Breakdown_Agent creates tasks, THE Project_Breakdown_Agent SHALL scope each task to 90 minutes or less of estimated effort
4. WHEN the Project_Breakdown_Agent creates tasks, THE Project_Breakdown_Agent SHALL assign a priority (LOW, MEDIUM, HIGH, or URGENT) to each task
5. WHEN a deadline is provided, THE Project_Breakdown_Agent SHALL calculate due dates for tasks distributed across the project timeline
6. WHEN the Project_Breakdown_Agent creates tasks, THE Project_Breakdown_Agent SHALL assign relevant tags to each task for categorization
7. WHEN the Project_Breakdown_Agent creates tasks, THE Project_Breakdown_Agent SHALL estimate effort hours for each task
8. WHEN the Project_Breakdown_Agent completes task creation, THE Project_Breakdown_Agent SHALL return a JSON response containing `projectName`, `totalTasks`, `estimatedTotalHours`, `workStreams`, `criticalPath`, `projectDuration`, and `summary` fields

### Requirement 4: Task Analyzer Agent SOP

**User Story:** As a user, I want to describe a task in natural language and receive structured metadata, so that I can quickly create well-categorized tasks.

#### Acceptance Criteria

1. WHEN the Task_Analyzer_Agent receives a task description, THE Task_Analyzer_Agent SHALL analyze the description without making any tool calls
2. WHEN the Task_Analyzer_Agent analyzes a task description, THE Task_Analyzer_Agent SHALL return a JSON response containing `priority`, `estimatedMinutes`, `dueDate`, `tags`, and `reasoning` fields
3. WHEN the Task_Analyzer_Agent determines priority, THE Task_Analyzer_Agent SHALL assign one of `high`, `medium`, or `low`
4. WHEN the task description contains temporal references (e.g., "tomorrow", "next Friday"), THE Task_Analyzer_Agent SHALL resolve the temporal reference to an ISO 8601 date string using the Enriched_Query timestamp context
5. WHEN the task description contains no temporal references, THE Task_Analyzer_Agent SHALL return `null` for the `dueDate` field

### Requirement 5: Daily Planner Agent SOP

**User Story:** As a user, I want to generate an optimized daily schedule from my incomplete tasks, so that I can plan my workday effectively.

#### Acceptance Criteria

1. WHEN the Daily_Planner_Agent receives a date and optional list ID, THE Daily_Planner_Agent SHALL call `get_tasks` to retrieve incomplete tasks
2. WHEN the Daily_Planner_Agent builds a schedule, THE Daily_Planner_Agent SHALL prioritize overdue tasks and tasks due on the requested date
3. WHEN the Daily_Planner_Agent builds a schedule, THE Daily_Planner_Agent SHALL assign high-focus tasks to morning time blocks and lighter tasks to afternoon time blocks
4. WHEN the Daily_Planner_Agent builds a schedule, THE Daily_Planner_Agent SHALL limit the total scheduled time to 8 hours
5. WHEN tasks exceed the 8-hour limit, THE Daily_Planner_Agent SHALL place excess tasks in an `unscheduledTasks` array
6. WHEN the Daily_Planner_Agent completes scheduling, THE Daily_Planner_Agent SHALL return a JSON response containing `schedule` (array of time blocks with `startTime`, `endTime`, `taskId`, `taskName`, `reasoning`), `unscheduledTasks`, and `summary` fields

### Requirement 6: Task Recommender Agent SOP

**User Story:** As a user, I want to receive a recommendation for the single best task to work on right now, so that I can reduce decision fatigue and start working immediately.

#### Acceptance Criteria

1. WHEN the Task_Recommender_Agent receives a request with an optional list ID, THE Task_Recommender_Agent SHALL call `get_tasks` to retrieve incomplete tasks
2. WHEN the Task_Recommender_Agent evaluates tasks, THE Task_Recommender_Agent SHALL apply Eisenhower Matrix scoring (urgent/important dimensions) to rank tasks
3. WHEN the Task_Recommender_Agent evaluates tasks, THE Task_Recommender_Agent SHALL consider the current time of day for energy-level appropriateness
4. WHEN the Task_Recommender_Agent completes evaluation, THE Task_Recommender_Agent SHALL return a JSON response containing `recommendedTaskId`, `taskName`, `reasoning`, `alternatives` (array of 1-2 objects with `taskId` and `reason`), and `estimatedCompletion` fields

### Requirement 7: SOP Bundling

**User Story:** As a developer, I want the new SOP files to be automatically bundled into the TypeScript SOP bundle, so that they are available at Lambda runtime without filesystem reads.

#### Acceptance Criteria

1. WHEN the Bundle_Script executes, THE Bundle_Script SHALL read all markdown files from the `sops/` directory including the four new SOP files
2. WHEN the Bundle_Script generates the SOP_Bundle, THE SOP_Bundle SHALL export each SOP as a named TypeScript string constant
3. WHEN the Bundle_Script generates the SOP_Bundle, THE SOP_Bundle SHALL export an `allSops` record mapping filenames to their string constants
4. THE SOP_Bundle SHALL include entries for `orchestrator.md`, `project-breakdown.md`, `task-analyzer.md`, `daily-planner.md`, and `task-recommender.md` in addition to the existing `task-management.md`

### Requirement 8: Backward Compatibility

**User Story:** As a user of the existing task management agent, I want the current general-purpose agent to continue working unchanged, so that existing functionality is preserved.

#### Acceptance Criteria

1. WHEN the Lambda_Handler receives a request matching the existing general query pattern (no `queryType` or unrecognized `queryType`), THE Lambda_Handler SHALL invoke the existing task-management SOP with all tools
2. THE Lambda_Handler SHALL preserve the existing `enrichQuery` function behavior for all agent types
3. THE Lambda_Handler SHALL preserve the existing DynamoDB client initialization and table name resolution for all agent types

### Requirement 9: Agent Response Validation

**User Story:** As a developer, I want agent responses to be validated before returning to the client, so that the frontend receives predictable JSON structures.

#### Acceptance Criteria

1. WHEN an agent returns a response, THE Lambda_Handler SHALL parse the response as JSON
2. IF an agent response is not valid JSON, THEN THE Lambda_Handler SHALL return a structured error response with an `error` field and the raw response in a `rawResponse` field
3. WHEN the Lambda_Handler returns a response for any agent, THE Lambda_Handler SHALL return a JSON string to the GraphQL resolver
