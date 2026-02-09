import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'

// Error message mapping for user-friendly messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    // Log the actual error for debugging
    console.error('Query/Mutation error:', error.message)
    
    // Authentication errors - be more specific
    if (message.includes('not authenticated') || message.includes('no current user')) {
      return 'Your session has expired. Please log in again.'
    }
    if (message.includes('invalid credentials')) {
      return 'Invalid email or password.'
    }
    
    // Bedrock/AI service errors
    if (message.includes('not authorized') && message.includes('bedrock')) {
      return 'AI service is not properly configured. Please contact support.'
    }
    if (message.includes('invalid model') || message.includes('model identifier')) {
      return 'AI model configuration error. Please contact support.'
    }
    if (message.includes('explicit deny')) {
      return 'AI service access is restricted. Please contact support.'
    }
    
    // Validation errors
    if (message.includes('cannot be empty')) {
      return error.message
    }
    if (message.includes('validation')) {
      return error.message
    }
    
    // Network errors
    if (message.includes('network') || message.includes('failed to fetch')) {
      return 'Unable to connect. Please check your internet connection.'
    }
    
    // Not found errors
    if (message.includes('not found')) {
      return 'The requested resource no longer exists.'
    }
    
    // Permission/Authorization errors (not session expiry)
    if (message.includes('unauthorized') || message.includes('permission') || message.includes('access denied')) {
      return "You don't have permission to perform this action."
    }
    
    return error.message
  }
  
  return 'Something went wrong. Please try again.'
}

// Determine if error should trigger retry
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    // Don't retry auth errors, validation errors, or permission errors
    if (
      message.includes('unauthorized') ||
      message.includes('not authorized') || // Bedrock permission errors
      message.includes('not authenticated') ||
      message.includes('no current user') ||
      message.includes('validation') ||
      message.includes('cannot be empty') ||
      message.includes('permission') ||
      message.includes('not found') ||
      message.includes('invalid model') || // Bedrock model errors
      message.includes('explicit deny') // AWS SCP denials
    ) {
      return false
    }
  }
  
  return true
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only show toast for queries that have already been fetched (not initial loads)
      if (query.state.data !== undefined) {
        toast({
          variant: 'destructive',
          title: 'Error loading data',
          description: getErrorMessage(error),
        })
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getErrorMessage(error),
      })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: shouldRetry,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false, // Disable retries for mutations - they're user-initiated actions
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
})
