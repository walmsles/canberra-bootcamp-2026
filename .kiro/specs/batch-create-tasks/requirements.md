# Requirements Document

## Introduction

The Project Breakdown agent currently creates tasks one at a time using the `create_task` tool, issuing a separate DynamoDB `PutItem` call for each task. When decomposing a project brief into many tasks, this sequential approach is slow and risks Lambda timeouts. This feature introduces a `create_tasks` (plural) batch tool that accepts an array of tasks and writes them using DynamoDB `BatchWriteItem`, reducing round trips and execution time. The existing `create_task` tool remains unchanged for backward compatibility.

## Glossary

- **Batch_Tool**: The new `create_tasks` tool that accepts an array of task inputs and writes them to DynamoDB using `BatchWriteItem`
- **Single_Tool**: The existing `create_task` tool that creates one task per DynamoDB `PutItem` call
- **Handler**: The Lambda handler at `handler.ts` that registers tools and invokes the SOP orchestrator
- **Project_Breakdown_SOP**: The SOP markdown file that instructs the Project Breakdown agent on how to decompose briefs into tasks
- **BatchWriteItem**: A DynamoDB operation that writes up to 25 items per request
- **Unprocessed_Items**: Items that DynamoDB could not write in a `BatchWriteItem` call due to throughput limits

## Requirements

### Requirement 1: Batch Task Creation Tool

**User Story:** As the Project Breakdown agent, I want to create multiple tasks in a single tool call, so that project decomposition completes faster and avoids Lambda timeouts.

#### Acceptance Criteria

1. WHEN the Batch_Tool receives an array of valid task inputs, THE Batch_Tool SHALL validate each task input using the same validation rules as the Single_Tool
2. WHEN all task inputs pass validation, THE Batch_Tool SHALL write all tasks to DynamoDB using `BatchWriteItem` requests of up to 25 items each
3. WHEN the input array contains more than 25 tasks, THE Batch_Tool SHALL split the array into chunks of 25 and issue multiple `BatchWriteItem` requests
4. WHEN DynamoDB returns Unprocessed_Items, THE Batch_Tool SHALL retry those items with exponential backoff up to 3 retry attempts
5. IF any task input fails validation, THEN THE Batch_Tool SHALL reject the entire batch and return all validation errors without writing any tasks to DynamoDB
6. WHEN the Batch_Tool successfully writes all tasks, THE Batch_Tool SHALL return a response containing the count of created tasks and the array of created task items
7. IF a DynamoDB `BatchWriteItem` call fails, THEN THE Batch_Tool SHALL return an error response indicating the failure and the number of tasks that were successfully written before the failure

### Requirement 2: Tool Registration

**User Story:** As a developer, I want the batch tool registered alongside existing tools in the Lambda handler, so that agents can use it without modifying the handler architecture.

#### Acceptance Criteria

1. THE Handler SHALL register the Batch_Tool with the name `create_tasks` in the orchestrator tools map
2. THE Handler SHALL define an input schema for `create_tasks` that accepts a `tasks` property as an array of task objects and a `listId` property as a required string
3. WHEN the Handler registers the Batch_Tool, THE Handler SHALL preserve all existing tool registrations unchanged

### Requirement 3: SOP Update

**User Story:** As the Project Breakdown agent, I want my SOP to instruct me to use the batch tool, so that I create all tasks in a single call instead of one at a time.

#### Acceptance Criteria

1. THE Project_Breakdown_SOP SHALL list `create_tasks` in its tools frontmatter
2. THE Project_Breakdown_SOP SHALL instruct the agent to collect all tasks first, then create them in a single `create_tasks` call
3. THE Project_Breakdown_SOP SHALL instruct the agent to pass the `listId` once at the top level rather than per task
4. THE Project_Breakdown_SOP SHALL retain `get_lists` in its tools frontmatter for list verification

### Requirement 4: Backward Compatibility

**User Story:** As a developer, I want the existing single-task tool to remain unchanged, so that other agents and flows that depend on it continue to work.

#### Acceptance Criteria

1. THE Single_Tool SHALL remain registered in the Handler with its existing name, schema, and behavior
2. THE Batch_Tool SHALL reuse the `buildCreateTaskItem` helper from the Single_Tool for per-item validation and item construction
