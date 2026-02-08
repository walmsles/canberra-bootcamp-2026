# Design Document: Task Agent Specialists

## Overview

This feature extends the existing `task-agents` Lambda function with four specialized AI agents, each accessible via a dedicated GraphQL custom query. The core approach is to define new SOP files (including an orchestrator SOP with `type: orchestrator`) and let the `@serverless-dna/sop-agents` framework handle routing. The handler builds a prompt that includes the `queryType` and arguments; the orchestrator SOP delegates to the correct specialist.

The architecture preserves full backward compatibility — requests without a `queryType` (or with an unrecognized one) continue to use the existing `task-management` SOP with all tools.

## Architecture

```mermaid
graph TD
    subgraph "Frontend"
        A1[client.queries.breakdownProject]
        A2[client.queries.analyzeTask]
        A3[client.queries.planDay]
        A4[client.queries.recommendTask]
        A5[client.queries.askAgent - existing]
    end

    subgraph "GraphQL Layer"
        GQL[Amplify Data Schema<br/>Custom Queries]
    end

    subgraph "Lambda: task-agents"
        H[Handler]
        
        subgraph "SOPs written to /tmp"
            ORCH[orchestrator.md<br/>Routes to specialist]
            S1[project-breakdown.md]
            S2[task-analyzer.md]
            S3[daily-planner.md]
            S4[task-recommender.md]
            S5[task-management.md]
        end

        subgraph "Tools"
            T1[create_task]
            T2[get_tasks]
            T3[get_lists]
            T4[create_tasks<br/>batch tool]
        end

        ORC[Orchestrator<br/>@serverless-dna/sop-agents]
    end

    subgraph "AWS Services"
        BED[Amazon Bedrock<br/>Claude]
        DDB[DynamoDB<br/>TodoItem / TodoList]
    end

    A1 & A2 & A3 & A4 & A5 --> GQL
    GQL --> H
    H --> ORC
    ORC --> ORCH
    ORCH --> S1 & S2 & S3 & S4
    ORC --> S5
    ORC --> T1 & T2 & T3 & T4
    ORC --> BED
    T1 & T2 & T3 & T4 --> DDB
```

### Routing Strategy

The `@serverless-dna/sop-agents` framework handles routing natively when an `orchestrator.md` SOP with `type: orchestrator` is present. The handler's job is simply to build a prompt that includes the `queryType` and arguments — the orchestrator SOP reads the `queryType` and delegates to the correct specialist agent.

All SOPs (the orchestrator + 4 specialists + existing task-management) are written to `/tmp/sops` and loaded by `createOrchestrator`.

The flow is:
1. Handler writes all SOPs to `/tmp/sops` (unchanged pattern, now includes 5 new SOPs)
2. Handler builds a prompt that includes the `queryType` and arguments alongside enriched timestamp context
3. Handler creates the orchestrator with all 4 tools: `create_task`, `create_tasks`, `get_tasks`, `get_lists` (specialist SOPs declare which tools they need)
4. The orchestrator SOP reads the `queryType` and delegates to the matching specialist agent
5. The specialist agent executes with its declared tools and returns its JSON output
6. Handler validates the JSON response

For backward compatibility, when no `queryType` is present (legacy requests), the enriched query is passed directly and the orchestrator/task-management SOP handles it as before.

### Event Shape

The current handler expects:
```typescript
{ arguments: { query: string } }
```

The new handler will accept a union:
```typescript
// Existing general query
{ arguments: { query: string } }

// New specialized queries — each GraphQL query passes its args
{ arguments: { queryType: string; [key: string]: unknown } }
```

Each custom query handler in the GraphQL schema will pass the `queryType` field along with the query-specific arguments. The handler uses `queryType` to build the prompt, and the orchestrator SOP handles routing to the correct specialist.

## Components and Interfaces

### 1. Orchestrator SOP (`orchestrator.md`)

The key new component is a top-level orchestrator SOP that acts as the routing brain. This SOP is loaded by `createOrchestrator` alongside all specialist SOPs. It receives the enriched prompt (which includes `queryType` and arguments) and contains explicit instructions to delegate to the correct specialist.

The orchestrator SOP frontmatter uses `type: orchestrator` with no tools listed — tools are declared on the individual agent SOPs only. The SOP body contains a routing table:

```markdown
---
name: orchestrator
description: Routes incoming requests to the correct specialist agent based on query type
version: 1.0.0
type: orchestrator
---

# Agent Orchestrator

## Overview
You are a routing orchestrator. Your job is to read the query type and delegate
to the correct specialist agent. You MUST follow the routing rules exactly.

## Routing Rules

1. If queryType is `breakdownProject`: Follow the Project Breakdown procedure
2. If queryType is `analyzeTask`: Follow the Task Analyzer procedure
3. If queryType is `planDay`: Follow the Daily Planner procedure
4. If queryType is `recommendTask`: Follow the Task Recommender procedure

## Important
- You MUST delegate to the correct specialist agent based on the queryType
- You MUST NOT add any text before or after the agent's response
- You MUST NOT modify the agent's response
```

The orchestrator delegates to specialist agents by name — it does not have access to the specialist SOP content. Each specialist SOP independently defines its own behavior, tools, and JSON output format. The `@serverless-dna/sop-agents` framework handles the actual delegation when the orchestrator references a specialist agent name.

### 2. Prompt Building (in handler)

The handler builds the prompt inline based on whether `queryType` is present in the event arguments. No separate router module is needed — the framework's orchestrator SOP handles routing.

When `queryType` is present, the handler constructs a prompt like:
```
Current Date and Time: <timestamp>
Date: <date> (<dayOfWeek>)
Time: <time>
Query Type: <queryType>
<argument key>: <argument value>
...
```

When `queryType` is absent (legacy), the handler uses the existing `enrichQuery` function on `event.arguments.query`.

### 3. Response Validator

A utility function to validate and normalize agent responses:

```typescript
interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  rawResponse?: string;
}

function validateAgentResponse(raw: string): AgentResponse;
```

This function:
- Attempts `JSON.parse` on the raw orchestrator output
- If successful, returns `{ success: true, data: parsed }`
- If parsing fails, returns `{ success: false, error: 'Invalid JSON response', rawResponse: raw }`

### 4. Updated Handler

The handler is updated to:
1. Write all SOPs to disk (unchanged pattern, now includes orchestrator + 4 specialists)
2. Check if `queryType` is present in event arguments
3. If present: build prompt with queryType and arguments alongside enriched timestamp
4. If absent: use existing `enrichQuery` on `event.arguments.query` (backward compatible)
5. Create orchestrator with all 4 tools: `create_task`, `create_tasks`, `get_tasks`, `get_lists` (specialist SOPs declare which tools they use)
6. Invoke orchestrator with the constructed prompt
7. Validate the response with `validateAgentResponse`
8. Return the JSON string

### 5. GraphQL Custom Queries

Four new custom queries added to `amplify/data/resource.ts`:

```typescript
breakdownProject: a
  .query()
  .arguments({
    listId: a.string().required(),
    projectBrief: a.string().required(),
    deadline: a.string(),
  })
  .returns(a.string())
  .authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(taskAgents)),

analyzeTask: a
  .query()
  .arguments({
    taskDescription: a.string().required(),
  })
  .returns(a.string())
  .authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(taskAgents)),

planDay: a
  .query()
  .arguments({
    date: a.string().required(),
    listId: a.string(),
  })
  .returns(a.string())
  .authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(taskAgents)),

recommendTask: a
  .query()
  .arguments({
    listId: a.string(),
  })
  .returns(a.string())
  .authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(taskAgents)),
```

### 6. SOP Files

Six SOP markdown files in `amplify/functions/task-agents/sops/`:

- `orchestrator.md` — Type: `orchestrator`. No tools (tools are declared on individual agent SOPs). The top-level routing SOP that reads `queryType` from the prompt and delegates to the correct specialist procedure. Contains explicit routing rules and output format enforcement.
- `project-breakdown.md` — Tools: `create_tasks`, `get_lists`. Uses the batch `create_tasks` tool (from the `batch-create-tasks` feature) to create all decomposed tasks in a single call. Instructs the model to decompose briefs into appropriately-scoped tasks (each ≤90 minutes of effort) with priorities, due dates, tags, and effort estimates. Output format specified as JSON.
- `task-analyzer.md` — Tools: none. Instructs the model to extract priority, estimated minutes, due date, tags, and reasoning from a task description. Output format specified as JSON.
- `daily-planner.md` — Tools: `get_tasks`. Instructs the model to fetch incomplete tasks, apply energy management scheduling, limit to 8 hours, and return time blocks. Output format specified as JSON.
- `task-recommender.md` — Tools: `get_tasks`. Instructs the model to fetch incomplete tasks, apply Eisenhower Matrix scoring with time-of-day energy consideration, and recommend one task. Output format specified as JSON.
- `task-management.md` — Existing SOP, unchanged.

Each SOP follows the existing frontmatter format:
```yaml
---
name: <sop-name>
description: <description>
version: 1.0.0
type: agent  # or 'orchestrator' for the top-level routing SOP (no tools on orchestrator)
tools:       # only on agent SOPs
  - <tool_name>
---
```

## Data Models

### Event Input Types

```typescript
// Base event shape (existing)
interface BaseEvent {
  arguments: Record<string, unknown>;
}

// Typed argument shapes per query
interface BreakdownProjectArgs {
  queryType: 'breakdownProject';
  listId: string;
  projectBrief: string;
  deadline?: string;
}

interface AnalyzeTaskArgs {
  queryType: 'analyzeTask';
  taskDescription: string;
}

interface PlanDayArgs {
  queryType: 'planDay';
  date: string;
  listId?: string;
}

interface RecommendTaskArgs {
  queryType: 'recommendTask';
  listId?: string;
}

interface GeneralQueryArgs {
  query: string;
}
```

### Agent Output Types

```typescript
interface BreakdownProjectOutput {
  projectName: string;
  totalTasks: number;
  estimatedTotalHours: number;
  workStreams: string[];
  criticalPath: string[];
  projectDuration: string;
  summary: string;
}

interface AnalyzeTaskOutput {
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  dueDate: string | null;
  tags: string[];
  reasoning: string;
}

interface ScheduleBlock {
  startTime: string;
  endTime: string;
  taskId: string;
  taskName: string;
  reasoning: string;
}

interface PlanDayOutput {
  schedule: ScheduleBlock[];
  unscheduledTasks: string[];
  summary: string;
}

interface RecommendTaskOutput {
  recommendedTaskId: string;
  taskName: string;
  reasoning: string;
  alternatives?: Array<{ taskId: string; reason: string }>;
  estimatedCompletion: string;
}
```

### Agent Response Wrapper

```typescript
interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  rawResponse?: string;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Most of the acceptance criteria in this feature relate to LLM-driven SOP behavior (Requirements 3–6), which is non-deterministic and not amenable to property-based testing. The testable surface is concentrated in the response validation (Requirement 9). Routing (Requirement 1) is handled by the `@serverless-dna/sop-agents` framework via the orchestrator SOP — the handler's role is prompt construction, which is deterministic but best covered by unit tests for specific examples.

### Property 1: Valid JSON responses parse successfully

*For any* valid JSON string, the response validator SHALL return a success result where `success` is `true` and `data` equals the parsed JSON object.

**Validates: Requirements 9.1, 9.3**

### Property 2: Invalid JSON responses return structured errors

*For any* string that is not valid JSON, the response validator SHALL return a result where `success` is `false`, `error` is a non-empty string, and `rawResponse` equals the original input string.

**Validates: Requirements 9.2, 9.3**

## Error Handling

| Scenario | Handling |
|---|---|
| Unknown `queryType` | Fall back to task-management SOP with all tools; log warning |
| Missing `queryType` (legacy request) | Fall back to task-management SOP with all tools (no warning) |
| Agent returns non-JSON response | Return `{ success: false, error: "Invalid JSON response", rawResponse: "<raw>" }` |
| Orchestrator throws an error | Catch, log error, return `{ success: false, error: "<message>" }` |
| Missing required arguments (e.g., no `listId` for breakdownProject) | GraphQL schema validation rejects the request before Lambda is invoked |
| DynamoDB errors during tool execution | Existing tool error handling returns `{ success: false, error: "<message>" }` — unchanged |
| Bedrock API errors | Orchestrator propagates error; handler catches and returns structured error |

## Testing Strategy

### Property-Based Tests

Use `fast-check` (already in devDependencies) with `vitest` (already configured) for property-based testing.

Each property test runs a minimum of 100 iterations.

- **Property 1**: Generate arbitrary JSON-serializable objects, stringify them, pass to validator. Assert `success === true` and `data` deep-equals the original object.
  - Tag: **Feature: task-agent-specialists, Property 1: Valid JSON responses parse successfully**
- **Property 2**: Generate strings that are not valid JSON (e.g., random strings with unbalanced braces). Pass to validator. Assert `success === false` and `rawResponse` equals input.
  - Tag: **Feature: task-agent-specialists, Property 2: Invalid JSON responses return structured errors**

### Unit Tests

- **Prompt construction**: Verify the handler builds the correct prompt string for each queryType with and without optional arguments (e.g., deadline for breakdownProject, listId for planDay). Verify legacy requests use `enrichQuery`.
- **Response validator**: Test with specific valid JSON strings, empty string, plain text, partial JSON.
- **SOP bundle**: After running `bundle-sops`, verify the generated `sops-bundle.ts` exports all 6 SOPs (orchestrator + 4 specialists + task-management).

### Test File Organization

```
amplify/functions/task-agents/
  __tests__/
    validate-response.test.ts  # Response validator unit + property tests
```
