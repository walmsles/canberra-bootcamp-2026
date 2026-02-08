import { useMutation } from '@tanstack/react-query'
import { getClient } from '../lib/amplify-client'
import {
  parseTaskAnalysis,
  parseProjectBreakdown,
  parseDailyPlan,
  parseTaskRecommendation,
  type TaskAnalysis,
  type ProjectBreakdownResult,
  type DailyPlanResult,
  type TaskRecommendation,
} from '../lib/ai-response-parser'

export function useAnalyzeTask() {
  const mutation = useMutation({
    mutationFn: async (taskDescription: string) => {
      const client = getClient()
      const { data, errors } = await client.queries.analyzeTask({ taskDescription })
      if (errors) throw new Error(errors[0].message)
      if (!data) throw new Error('No response from analyzeTask')
      const result = parseTaskAnalysis(data)
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
  const mutation = useMutation({
    mutationFn: async (params: { listId: string; projectBrief: string; deadline?: string }) => {
      const client = getClient()
      const { data, errors } = await client.queries.breakdownProject({
        listId: params.listId,
        projectBrief: params.projectBrief,
        deadline: params.deadline,
      })
      if (errors) throw new Error(errors[0].message)
      if (!data) throw new Error('No response from breakdownProject')
      const result = parseProjectBreakdown(data)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })

  return {
    breakdown: (listId: string, projectBrief: string, deadline?: string) => {
      if (mutation.isPending) return
      mutation.mutateAsync({ listId, projectBrief, deadline }).catch(() => {})
    },
    data: mutation.data ?? null,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
    reset: mutation.reset,
  }
}

export function usePlanDay() {
  const mutation = useMutation({
    mutationFn: async (params: { date: string; listId?: string }) => {
      const client = getClient()
      const { data, errors } = await client.queries.planDay({
        date: params.date,
        listId: params.listId,
      })
      if (errors) throw new Error(errors[0].message)
      if (!data) throw new Error('No response from planDay')
      const result = parseDailyPlan(data)
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
      const client = getClient()
      const { data, errors } = await client.queries.recommendTask({
        listId: params.listId,
      })
      if (errors) throw new Error(errors[0].message)
      if (!data) throw new Error('No response from recommendTask')
      const result = parseTaskRecommendation(data)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })

  return {
    recommend: (listId?: string) => {
      if (mutation.isPending) return
      mutation.mutateAsync({ listId }).catch(() => {})
    },
    data: mutation.data ?? null,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
    reset: mutation.reset,
  }
}

export type { TaskAnalysis, ProjectBreakdownResult, DailyPlanResult, TaskRecommendation }
