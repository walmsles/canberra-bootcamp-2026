import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import {
  parseTaskAnalysis,
  parseDailyPlan,
  parseTaskRecommendation,
  type TaskAnalysis,
  type ProjectBreakdownResult,
  type DailyPlanResult,
  type TaskRecommendation,
} from '../lib/ai-response-parser'

const client = generateClient<Schema>()

// Helper to create a job and wait for completion via polling
async function createAndWaitForJob(
  queryType: string,
  requestData: Record<string, unknown>
): Promise<unknown> {
  // Create the job
  const { data: job, errors } = await client.models.AgentJob.create({
    queryType,
    status: 'PENDING',
    requestData: JSON.stringify(requestData),
  })

  if (errors || !job) {
    throw new Error(errors?.[0]?.message || 'Failed to create agent job')
  }

  console.log('Created job:', job.id, 'Polling for completion...')

  // Poll for job completion every 5 seconds
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const maxDuration = 15 * 60 * 1000 // 15 minutes
    
    const pollInterval = setInterval(async () => {
      try {
        if (Date.now() - startTime > maxDuration) {
          clearInterval(pollInterval)
          reject(new Error('Job timed out after 15 minutes'))
          return
        }

        const { data: updatedJob } = await client.models.AgentJob.get({ id: job.id })
        
        if (!updatedJob) {
          console.log('Job not found, continuing...')
          return
        }

        console.log('Job status:', updatedJob.status)

        if (updatedJob.status === 'COMPLETE') {
          clearInterval(pollInterval)
          console.log('Job complete!')
          
          // resultData is double-JSON-encoded, need to parse twice
          let resultData = updatedJob.resultData
          if (resultData) {
            // First parse: string -> string (removes outer quotes)
            const firstParse = JSON.parse(resultData as string)
            // Second parse: string -> object
            resultData = typeof firstParse === 'string' ? JSON.parse(firstParse) : firstParse
          }
          
          resolve(resultData)
        } else if (updatedJob.status === 'FAILED') {
          clearInterval(pollInterval)
          console.log('Job failed!')
          reject(new Error(updatedJob.error || 'Job failed'))
        }
      } catch (error) {
        console.error('Error polling job:', error)
      }
    }, 5000) // Poll every 5 seconds
  })
}

export function useAnalyzeTask() {
  const mutation = useMutation({
    mutationFn: async (taskDescription: string) => {
      const resultData = await createAndWaitForJob('analyzeTask', { taskDescription })
      
      const result = parseTaskAnalysis(JSON.stringify(resultData))
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })

  return {
    analyze: (taskDescription: string) => {
      if (mutation.isPending) return
      mutation.mutateAsync(taskDescription).catch(() => {})
    },
    data: mutation.data ?? null,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
    reset: mutation.reset,
  }
}

export function useBreakdownProject() {
  const queryClient = useQueryClient()
  
  const mutation = useMutation({
    mutationFn: async (params: { listId: string; projectBrief: string; deadline?: string }) => {
      const resultData = await createAndWaitForJob('breakdownProject', params)
      
      console.log('Raw resultData:', resultData)
      console.log('Type of resultData:', typeof resultData)
      console.log('Has data field:', resultData && typeof resultData === 'object' && 'data' in resultData)
      
      // resultData is already parsed as an object with { success: true, data: {...} }
      const parsed = resultData as { success: boolean; data?: Record<string, unknown>; error?: string }
      
      console.log('Parsed resultData:', parsed)
      console.log('Success:', parsed.success)
      
      // Check if the operation was successful
      if (!parsed.success) {
        const errorMsg = parsed.error || 'Agent returned an error'
        console.error('Agent error:', errorMsg)
        throw new Error(errorMsg)
      }
      
      // Extract the data field from the wrapper { success: true, data: {...} }
      if (parsed.data) {
        const data = parsed.data
        
        console.log('Extracted data:', data)
        
        // The orchestrator returns metadata (projectName, totalTasks, summary, etc.)
        // Tasks are already created in the database by the create_tasks tool
        // Return a simplified result with just the summary and task count
        const result = {
          tasks: [], // Tasks are already in DB, no need to return them
          summary: (data.summary as string) || 'Project breakdown complete',
          totalTasks: (data.totalTasks as number) || 0,
          listId: params.listId,
        }
        
        console.log('Returning result:', result)
        return result
      }
      
      console.error('Invalid response format - no data field:', parsed)
      throw new Error('Invalid response format from agent')
    },
    onSuccess: (data) => {
      console.log('Mutation onSuccess triggered', data)
      // Invalidate all todos queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
    onError: (error) => {
      console.log('Mutation onError triggered', error)
    },
  })

  return {
    breakdown: (listId: string, projectBrief: string, deadline?: string) => {
      if (mutation.isPending) {
        console.warn('Breakdown already in progress, skipping duplicate call')
        return
      }
      mutation.mutate({ listId, projectBrief, deadline })
    },
    data: mutation.data ?? null,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
    reset: mutation.reset,
    isSuccess: mutation.isSuccess,
  }
}

export function usePlanDay() {
  const mutation = useMutation({
    mutationFn: async (params: { date: string; listId?: string }) => {
      const resultData = await createAndWaitForJob('planDay', params)
      
      const result = parseDailyPlan(JSON.stringify(resultData))
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })

  return {
    plan: (date: string, listId?: string) => {
      if (mutation.isPending) return
      mutation.mutateAsync({ date, listId }).catch(() => {})
    },
    data: mutation.data ?? null,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
    reset: mutation.reset,
  }
}

export function useRecommendTask() {
  const mutation = useMutation({
    mutationFn: async (params: { listId?: string }) => {
      try {
        console.log('recommendTask starting job...')
        const resultData = await createAndWaitForJob('recommendTask', params)
        
        console.log('recommendTask raw resultData:', resultData)
        console.log('recommendTask resultData type:', typeof resultData)
        
        // Extract data from wrapper { success: true, data: {...} }
        const parsed = resultData as { success: boolean; data?: Record<string, unknown>; error?: string }
        
        console.log('recommendTask parsed:', parsed)
        console.log('recommendTask parsed.success:', parsed.success)
        console.log('recommendTask parsed.data:', parsed.data)
        
        if (!parsed.success) {
          throw new Error(parsed.error || 'Agent returned an error')
        }
        
        if (!parsed.data) {
          throw new Error('Invalid response format from agent')
        }
        
        const result = parseTaskRecommendation(JSON.stringify(parsed.data))
        console.log('recommendTask parse result:', result)
        
        if (!result.success) throw new Error(result.error)
        return result.data
      } catch (error) {
        console.error('recommendTask error:', error)
        throw error
      }
    },
  })

  return {
    recommend: (listId?: string) => {
      if (mutation.isPending) return
      mutation.mutateAsync({ listId }).catch((err) => {
        console.error('recommendTask mutation error:', err)
      })
    },
    data: mutation.data ?? null,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
    reset: mutation.reset,
  }
}

export type { TaskAnalysis, ProjectBreakdownResult, DailyPlanResult, TaskRecommendation }
