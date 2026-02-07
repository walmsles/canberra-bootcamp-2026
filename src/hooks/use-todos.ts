import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '../lib/amplify-client'
import type { Schema } from '../../amplify/data/resource'

type TodoItem = Schema['TodoItem']['type']
type CreateTodoInput = Omit<Schema['TodoItem']['createType'], 'id' | 'createdAt' | 'updatedAt'>
type UpdateTodoInput = Schema['TodoItem']['updateType']

// Query keys factory
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (listId: string) => [...todoKeys.lists(), listId] as const,
  byOwner: (owner: string) => [...todoKeys.all, 'owner', owner] as const,
  byStatus: (status: string) => [...todoKeys.all, 'status', status] as const,
}

// Fetch todos for a list
export function useTodos(listId: string) {
  return useQuery({
    queryKey: todoKeys.list(listId),
    queryFn: async () => {
      const { data, errors } = await client.models.TodoItem.list({
        filter: { listId: { eq: listId } },
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    enabled: !!listId,
  })
}

// Fetch all todos for the current user
export function useAllTodos(owner: string) {
  return useQuery({
    queryKey: todoKeys.byOwner(owner),
    queryFn: async () => {
      // Amplify automatically filters by owner when using owner-based auth
      const { data, errors } = await client.models.TodoItem.list()
      if (errors) throw new Error(errors[0].message)
      return data
    },
    enabled: !!owner,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })
}

// Create todo mutation
export function useCreateTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      // Validate title is not empty or whitespace
      if (!input.title || input.title.trim() === '') {
        throw new Error('Todo title cannot be empty')
      }

      const { data, errors } = await client.models.TodoItem.create({
        title: input.title.trim(),
        description: input.description,
        status: input.status ?? 'PENDING',
        dueDate: input.dueDate,
        tags: input.tags,
        reminderMinutes: input.reminderMinutes,
        listId: input.listId,
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.listId) {
        queryClient.invalidateQueries({ queryKey: todoKeys.list(data.listId) })
      }
      if (data?.owner) {
        queryClient.invalidateQueries({ queryKey: todoKeys.byOwner(data.owner) })
      }
    },
  })
}

// Update todo mutation with optimistic updates
export function useUpdateTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateTodoInput & { id: string }) => {
      // Validate title if provided
      if (input.title !== undefined && (!input.title || input.title.trim() === '')) {
        throw new Error('Todo title cannot be empty')
      }

      const updateData: UpdateTodoInput & { id: string } = {
        ...input,
        title: input.title?.trim(),
      }

      // Set completedAt when marking as complete
      if (input.status === 'COMPLETE') {
        updateData.completedAt = new Date().toISOString()
        // Mark reminder as sent to prevent future notifications
        updateData.reminderSent = true
      }

      // Reset reminderSent when due date changes (to allow new reminder)
      if (input.dueDate !== undefined) {
        updateData.reminderSent = false
      }

      const { data, errors } = await client.models.TodoItem.update(updateData)
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onMutate: async (newTodo) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: todoKeys.all })

      // Snapshot the previous values
      const previousTodos = queryClient.getQueriesData({ queryKey: todoKeys.all })

      // Optimistically update all matching queries
      queryClient.setQueriesData(
        { queryKey: todoKeys.all },
        (old: TodoItem[] | undefined) => {
          if (!old) return old
          return old.map((todo) =>
            todo.id === newTodo.id
              ? {
                  ...todo,
                  ...newTodo,
                  completedAt: newTodo.status === 'COMPLETE' ? new Date().toISOString() : todo.completedAt,
                }
              : todo
          )
        }
      )

      return { previousTodos }
    },
    onError: (_err, _newTodo, context) => {
      // Rollback on error
      if (context?.previousTodos) {
        context.previousTodos.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after error or success
      if (variables.listId) {
        queryClient.invalidateQueries({ queryKey: todoKeys.list(variables.listId as string) })
      }
      queryClient.invalidateQueries({ queryKey: todoKeys.all })
    },
  })
}

// Delete todo mutation with optimistic updates
export function useDeleteTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, listId, owner }: { id: string; listId: string; owner: string }) => {
      const { errors } = await client.models.TodoItem.delete({ id })
      if (errors) throw new Error(errors[0].message)
      return { id, listId, owner }
    },
    onMutate: async ({ id }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: todoKeys.all })

      // Snapshot the previous values
      const previousTodos = queryClient.getQueriesData({ queryKey: todoKeys.all })

      // Optimistically remove the todo from all matching queries
      queryClient.setQueriesData(
        { queryKey: todoKeys.all },
        (old: TodoItem[] | undefined) => {
          if (!old) return old
          return old.filter((todo) => todo.id !== id)
        }
      )

      return { previousTodos }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousTodos) {
        context.previousTodos.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: todoKeys.list(variables.listId) })
      queryClient.invalidateQueries({ queryKey: todoKeys.byOwner(variables.owner) })
    },
  })
}

export type { TodoItem, CreateTodoInput, UpdateTodoInput }
