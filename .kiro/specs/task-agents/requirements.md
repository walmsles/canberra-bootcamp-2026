# Requirements Document

## Introduction

This feature adds an AI agent Lambda function (`task-agents`) to the existing Amplify Gen2 todo application. The agent uses the `@serverless-dna/sop-agents` framework to provide an LLM-powered orchestrator that can create tasks, retrieve tasks with filtering, and retrieve lists. The agent loads Standard Operating Procedures (SOPs) from a local `./sops/` directory and uses Amazon Bedrock (Claude) for inference. The function is invoked as a standard Lambda and returns the orchestrator result.

## Glossary

- **Task_Agents_Function**: The AWS Lambda function that hosts the SOP agent orchestrator
- **Orchestrator**: The `@serverless-dna/sop-agents` agent runtime that loads SOPs, registers tools, and invokes the LLM to fulfill requests
- **SOP**: Standard Operating Procedure — a structured instruction file loaded from the `./sops/` directory that guides the agent's behavior
- **Tool**: A callable function registered with the Orchestrator that performs a specific action (e.g., creating a task, querying tasks)
- **TodoItem**: The existing Amplify Data model representing a single todo task
- **TodoList**: The existing Amplify Data model representing a collection of TodoItems
- **DynamoDB_Client**: The AWS SDK DynamoDB Document Client used to perform CRUD operations directly against the DynamoDB tables backing the Amplify Data models
- **Bedrock**: Amazon Bedrock, the AWS service used to invoke Claude foundation models

## Requirements

### Requirement 1: Lambda Function Definition

**User Story:** As a developer, I want a properly configured Amplify Gen2 Lambda function for the agent, so that it integrates with the existing backend infrastructure.

#### Acceptance Criteria

1. THE Task_Agents_Function SHALL be defined using `defineFunction` from `@aws-amplify/backend` with the name `task-agents` and entry point `./handler.ts`
2. THE Task_Agents_Function SHALL have a timeout of 60 seconds
3. THE Task_Agents_Function SHALL be registered in `amplify/backend.ts` alongside existing backend resources
4. THE Task_Agents_Function SHALL have an IAM policy granting `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` permissions for Claude models
5. THE Task_Agents_Function SHALL have read and write access to the TodoItem and TodoList DynamoDB tables
6. THE Task_Agents_Function SHALL receive the TodoItem and TodoList table names as environment variables

### Requirement 2: Agent Orchestrator Initialization and Context Injection

**User Story:** As a developer, I want the Lambda handler to initialize the SOP agent orchestrator and enrich queries with temporal context, so that the agent can reason about relative dates and times.

#### Acceptance Criteria

1. WHEN the Task_Agents_Function is invoked, THE Orchestrator SHALL be initialized using the `@serverless-dna/sop-agents` package
2. THE Orchestrator SHALL load all SOP files from the `./sops/` directory relative to the handler file
3. THE Orchestrator SHALL be configured to use an Amazon Bedrock Claude model for inference
4. WHEN the Task_Agents_Function receives a user query, THE handler SHALL prepend the current date and time context including: ISO timestamp, date (YYYY-MM-DD), day of week, and time (HH:MM:SS)
5. THE handler SHALL format the enriched query as: `Current Date and Time: {timestamp}\nDate: {date} ({dayOfWeek})\nTime: {time}\nUser Query: {originalQuery}`
6. WHEN the Orchestrator completes processing, THE Task_Agents_Function SHALL return the result of `orchestrator.invoke()` called with the enriched query

### Requirement 3: Create Task Tool

**User Story:** As an agent user, I want the agent to create new TodoItems, so that I can add tasks through natural language.

#### Acceptance Criteria

1. THE Orchestrator SHALL register a tool named `create_task` that creates a TodoItem using the DynamoDB_Client
2. WHEN `create_task` is invoked, THE Tool SHALL accept parameters matching the TodoItem schema fields: title (required), description, status, dueDate, tags, reminderMinutes, priority, effortHours, and listId (required)
3. WHEN `create_task` is invoked with valid parameters, THE Tool SHALL create a new TodoItem record in the database and return the created item
4. IF `create_task` is invoked without a required field (title or listId), THEN THE Tool SHALL return a descriptive error message without creating a record

### Requirement 4: Get Tasks Tool

**User Story:** As an agent user, I want the agent to retrieve and filter TodoItems, so that I can query my tasks through natural language.

#### Acceptance Criteria

1. THE Orchestrator SHALL register a tool named `get_tasks` that retrieves TodoItems using the DynamoDB_Client
2. WHEN `get_tasks` is invoked, THE Tool SHALL accept optional filter parameters: listId, status, and dueDate range
3. WHEN `get_tasks` is invoked with filter parameters, THE Tool SHALL return only TodoItems matching all specified filters
4. WHEN `get_tasks` is invoked without filter parameters, THE Tool SHALL return all TodoItems accessible to the caller

### Requirement 5: Get Lists Tool

**User Story:** As an agent user, I want the agent to retrieve TodoLists, so that the agent can reference available lists when creating or querying tasks.

#### Acceptance Criteria

1. THE Orchestrator SHALL register a tool named `get_lists` that retrieves TodoLists using the DynamoDB_Client
2. WHEN `get_lists` is invoked, THE Tool SHALL return all TodoLists accessible to the caller, including each list's id and name

### Requirement 6: SOP Packaging

**User Story:** As a developer, I want the `./sops/` directory to be bundled with the Lambda deployment package, so that the agent can load SOPs at runtime.

#### Acceptance Criteria

1. THE Task_Agents_Function build configuration SHALL include the `./sops/` directory relative to the handler file in the Lambda deployment artifact
2. WHEN the Task_Agents_Function is deployed, THE `./sops/` directory SHALL be accessible at runtime from the handler's working directory

### Requirement 7: Schema Compatibility

**User Story:** As a developer, I want the agent tools to work with the TodoItem and TodoList schemas, so that no breaking changes are introduced.

#### Acceptance Criteria

1. THE `create_task` Tool SHALL only accept fields that exist in the current TodoItem schema (title, description, status, dueDate, completedAt, tags, reminderMinutes, reminderSent, priority, effortHours, listId)
2. THE `get_tasks` Tool SHALL only filter on fields that exist in the current TodoItem schema and its secondary indexes (listId, status, dueDate)
3. IF a caller provides a field that does not exist in the current schema, THEN THE Tool SHALL ignore the unknown field and log a warning

### Requirement 8: Schema Extension

**User Story:** As a developer, I want the TodoItem model to include priority and effort tracking fields, so that the agent can create richer task records.

#### Acceptance Criteria

1. THE TodoItem model SHALL include a `priority` field of type enum with values: LOW, MEDIUM, HIGH, URGENT
2. THE TodoItem model SHALL include an `effortHours` field of type float to represent estimated effort in hours
3. WHEN `priority` is not provided during task creation, THE system SHALL default to no priority (field remains unset)
4. WHEN `effortHours` is not provided during task creation, THE system SHALL default to no estimate (field remains unset)
