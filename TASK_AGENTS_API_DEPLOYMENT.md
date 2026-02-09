# Task Agents Async Processing Guide

## Overview

The task agents use an **async fire-and-forget pattern** with real-time updates via GraphQL subscriptions:

1. Frontend creates an `AgentJob` record with status `PENDING`
2. DynamoDB Stream triggers Lambda to process the job
3. Lambda updates job status to `PROCESSING`, then `COMPLETE` or `FAILED`
4. Frontend receives real-time updates via GraphQL subscription

## Benefits

- **No timeouts** - Lambda has full 15 minutes to process
- **Real-time updates** - Frontend gets instant notification when complete
- **Simple architecture** - No API Gateway, just DynamoDB + Lambda + Subscriptions
- **Automatic retries** - DynamoDB Streams handles retries on failure

## Architecture

```
Frontend → GraphQL (create AgentJob) → DynamoDB
                                          ↓
                                    DynamoDB Stream
                                          ↓
                                       Lambda
                                          ↓
                                    Update AgentJob
                                          ↓
                              GraphQL Subscription → Frontend
```

## Deployment Steps

### 1. Deploy the Backend

```bash
# Deploy to sandbox (development)
npx ampx sandbox

# OR deploy to production
npx ampx deploy --branch main
```

This will:
- Create the `AgentJob` DynamoDB table with streams enabled
- Deploy the Lambda function with DynamoDB Stream trigger
- Set up GraphQL API with subscriptions

### 2. Test the Flow

The frontend hooks automatically handle the async pattern:

```typescript
import { useRecommendTask } from '@/hooks/use-ai-agents'

function MyComponent() {
  const { recommend, data, isLoading, error } = useRecommendTask()
  
  // This creates a job and subscribes to updates
  const handleClick = () => {
    recommend('list-id-123')
  }
  
  // isLoading is true until job completes
  // data is populated when job status becomes COMPLETE
  // error is set if job status becomes FAILED
}
```

## How It Works

### Frontend (src/hooks/use-ai-agents.ts)

1. Creates `AgentJob` with `PENDING` status
2. Subscribes to updates on that specific job
3. Waits for status to change to `COMPLETE` or `FAILED`
4. Returns result data or error

### Backend (amplify/functions/task-agents/async-handler.ts)

1. DynamoDB Stream triggers on new `PENDING` jobs
2. Updates job status to `PROCESSING`
3. Invokes AI orchestrator with tools
4. Updates job status to `COMPLETE` with result data
5. On error, updates status to `FAILED` with error message

## Data Model

### AgentJob Table

```typescript
{
  id: string              // Auto-generated
  owner: string           // User ID (from Cognito)
  queryType: string       // 'breakdownProject' | 'analyzeTask' | 'planDay' | 'recommendTask'
  status: string          // 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED'
  requestData: string     // JSON string of request parameters
  resultData?: string     // JSON string of AI response (when COMPLETE)
  error?: string          // Error message (when FAILED)
  startedAt?: string      // ISO timestamp when processing started
  completedAt?: string    // ISO timestamp when completed/failed
  createdAt: string       // Auto-generated
  updatedAt: string       // Auto-generated
}
```

## Monitoring

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/amplify-canberra-mwalmsle-taskagentslambda8B68834F-cPpyeiklUR4j --follow

# Filter for specific job
aws logs filter-pattern /aws/lambda/amplify-canberra-mwalmsle-taskagentslambda8B68834F-cPpyeiklUR4j --filter-pattern "jobId"
```

### DynamoDB Console

Check the `AgentJob` table to see:
- Job status progression
- Processing times
- Error messages

### Metrics to Watch

- Lambda duration (should be < 15 minutes)
- Lambda errors and throttles
- DynamoDB Stream iterator age (should be near 0)
- Job completion rate (COMPLETE vs FAILED)

## Troubleshooting

### Jobs stuck in PENDING
- Check Lambda CloudWatch logs for errors
- Verify DynamoDB Stream is enabled on AgentJob table
- Check Lambda has event source mapping for the stream

### Jobs stuck in PROCESSING
- Lambda may have timed out or crashed
- Check CloudWatch logs for the specific job ID
- DynamoDB Streams will retry failed invocations

### Subscription not receiving updates
- Verify GraphQL subscription is active
- Check browser console for subscription errors
- Ensure user is authenticated

### Bedrock permission errors
- Check Lambda execution role has Bedrock permissions
- Verify model IDs are correct for your region
- Check for service control policies blocking Bedrock

## Cleanup

Old completed jobs can be cleaned up with TTL:

```typescript
// In amplify/data/resource.ts, add TTL to AgentJob model
AgentJob: a.model({
  // ... existing fields
  ttl: a.integer(), // Unix timestamp for when to delete
})
```

Then set TTL when creating jobs (e.g., delete after 24 hours):

```typescript
const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60)
await client.models.AgentJob.create({
  // ... other fields
  ttl,
})
```
