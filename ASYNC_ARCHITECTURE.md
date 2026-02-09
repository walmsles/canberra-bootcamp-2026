# Async Task Agents Architecture

## Quick Overview

**Problem:** API Gateway has 29-second timeout, AI processing takes longer
**Solution:** Fire-and-forget with GraphQL subscriptions for real-time updates

## Flow

```
1. User clicks "Recommend Task"
   ↓
2. Frontend creates AgentJob (status: PENDING)
   ↓
3. Frontend subscribes to AgentJob updates
   ↓
4. DynamoDB Stream triggers Lambda
   ↓
5. Lambda updates status to PROCESSING
   ↓
6. Lambda invokes AI orchestrator (can take 5-10 minutes)
   ↓
7. Lambda updates status to COMPLETE with results
   ↓
8. Subscription fires, frontend receives results
   ↓
9. UI updates with AI recommendations
```

## Key Files

### Backend
- `amplify/data/resource.ts` - AgentJob model definition
- `amplify/functions/task-agents/async-handler.ts` - DynamoDB Stream processor
- `amplify/backend.ts` - Wires up Stream trigger

### Frontend
- `src/hooks/use-ai-agents.ts` - Creates jobs and subscribes to updates

## Benefits

✅ No timeouts - Lambda has full 15 minutes
✅ Real-time updates via subscriptions
✅ Simple architecture - no API Gateway needed
✅ Automatic retries via DynamoDB Streams
✅ No duplicate calls - job is created once

## Testing

```bash
# Deploy
npx ampx sandbox

# Use the app - click any AI feature
# Watch CloudWatch logs to see job processing
aws logs tail /aws/lambda/amplify-canberra-mwalmsle-taskagentslambda8B68834F-cPpyeiklUR4j --follow
```

## How Frontend Knows It's Done

GraphQL subscription automatically fires when job status changes to `COMPLETE` or `FAILED`. The hook handles this transparently - just use `isLoading` and `data` like any other async operation.
