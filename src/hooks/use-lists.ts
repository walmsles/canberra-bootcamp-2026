import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '../lib/amplify-client'
import type { Schema } from '../../amplify/data/resource'
import { todoKeys } from './use-todos'

type TodoList = Schema['TodoList']['type']
type CreateListInput = Omit<Schema['TodoList']['createType'], 'id' | 'createdAt' | 'updatedAt'>
type UpdateListInput = Schema['TodoList']['updateType']

// Query keys factory
export const listKeys = {
  all: ['lists'] as const,
  byOwner: (owner: string) => [...listKeys.all, 'owner', owner] as const,
  byGroup: (groupId: string) => [...listKeys.all, 'group', groupId] as const,
  shared: (userId: string) => [...listKeys.all, 'shared', userId] as const,
  detail: (id: string) => [...listKeys.all, 'detail', id] as const,
}

// Fetch all lists for the current user (owned lists only)
export function useLists(owner: string) {
  return useQuery({
    queryKey: listKeys.byOwner(owner),
    queryFn: async () => {
      // Amplify automatically filters by owner when using owner-based auth
      const { data, errors } = await client.models.TodoList.list()
      if (errors) throw new Error(errors[0].message)
      // Sort by sortOrder (ascending), then by createdAt as fallback
      return [...data].sort((a, b) => {
        const orderA = a.sortOrder ?? 0
        const orderB = b.sortOrder ?? 0
        if (orderA !== orderB) return orderA - orderB
        // Fallback to createdAt if sortOrder is the same
        return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      })
    },
    enabled: !!owner,
  })
}

// Fetch lists shared with a specific group
export function useListsByGroup(groupId: string) {
  return useQuery({
    queryKey: listKeys.byGroup(groupId),
    queryFn: async () => {
      const { data, errors } = await client.models.TodoList.list({
        filter: { groupId: { eq: groupId } },
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    enabled: !!groupId,
  })
}

// Fetch all shared lists accessible to the user through their group memberships
export function useSharedLists(userId: string, memberGroupIds: string[]) {
  return useQuery({
    queryKey: listKeys.shared(userId),
    queryFn: async () => {
      if (memberGroupIds.length === 0) return []

      // Fetch lists from all groups the user is a member of
      const allLists: TodoList[] = []
      for (const groupId of memberGroupIds) {
        const { data, errors } = await client.models.TodoList.list({
          filter: { groupId: { eq: groupId } },
        })
        if (errors) throw new Error(errors[0].message)
        if (data) {
          // Only include lists not owned by the user (truly shared)
          allLists.push(...data.filter((list) => list.owner !== userId))
        }
      }
      return allLists
    },
    enabled: !!userId && memberGroupIds.length > 0,
  })
}

// Fetch a single list by ID
export function useList(id: string) {
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: async () => {
      const { data, errors } = await client.models.TodoList.get({ id })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    enabled: !!id,
  })
}

// Create list mutation
export function useCreateList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateListInput) => {
      // Validate name is not empty or whitespace
      if (!input.name || input.name.trim() === '') {
        throw new Error('List name cannot be empty')
      }

      const { data, errors } = await client.models.TodoList.create({
        name: input.name.trim(),
        description: input.description,
        groupId: input.groupId,
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.owner) {
        queryClient.invalidateQueries({ queryKey: listKeys.byOwner(data.owner) })
      }
    },
  })
}

// Update list mutation
export function useUpdateList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateListInput & { id: string }) => {
      // Validate name if provided
      if (input.name !== undefined && (!input.name || input.name.trim() === '')) {
        throw new Error('List name cannot be empty')
      }

      const updateData = {
        ...input,
        name: input.name?.trim(),
      }

      const { data, errors } = await client.models.TodoList.update(updateData)
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.owner) {
        queryClient.invalidateQueries({ queryKey: listKeys.byOwner(data.owner) })
        queryClient.invalidateQueries({ queryKey: listKeys.shared(data.owner) })
      }
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: listKeys.detail(data.id) })
      }
      if (data?.groupId) {
        queryClient.invalidateQueries({ queryKey: listKeys.byGroup(data.groupId) })
      }
      // Invalidate all shared lists queries since group membership may have changed
      queryClient.invalidateQueries({ queryKey: listKeys.all })
    },
  })
}

// Delete list mutation with cascade delete of todos
export function useDeleteList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, owner }: { id: string; owner: string }) => {
      // First, fetch all todos in this list
      const { data: todos, errors: fetchErrors } = await client.models.TodoItem.list({
        filter: { listId: { eq: id } },
      })
      if (fetchErrors) throw new Error(fetchErrors[0].message)

      // Delete all todos in the list
      if (todos && todos.length > 0) {
        await Promise.all(
          todos.map(async (todo) => {
            const { errors } = await client.models.TodoItem.delete(
              { id: todo.id },
              { authMode: 'userPool' }
            )
            if (errors) throw new Error(errors[0].message)
          })
        )
      }

      // Then delete the list itself
      const { errors } = await client.models.TodoList.delete(
        { id },
        { authMode: 'userPool' }
      )
      if (errors) throw new Error(errors[0].message)
      return { id, owner }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: listKeys.byOwner(data.owner) })
      queryClient.invalidateQueries({ queryKey: listKeys.detail(data.id) })
      queryClient.invalidateQueries({ queryKey: todoKeys.list(data.id) })
      queryClient.invalidateQueries({ queryKey: todoKeys.byOwner(data.owner) })
    },
  })
}

// Reorder lists mutation - updates sortOrder for multiple lists
export function useReorderLists() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ lists, owner }: { lists: { id: string; sortOrder: number }[]; owner: string }) => {
      // Update all lists with their new sort order
      await Promise.all(
        lists.map(async ({ id, sortOrder }) => {
          const { errors } = await client.models.TodoList.update(
            { id, sortOrder },
            { authMode: 'userPool' }
          )
          if (errors) throw new Error(errors[0].message)
        })
      )
      return { owner }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: listKeys.byOwner(data.owner) })
    },
  })
}

export type { TodoList, CreateListInput, UpdateListInput }
