import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '../lib/amplify-client'
import type { Schema } from '../../amplify/data/resource'

type UserSettings = Schema['UserSettings']['type']
type CreateSettingsInput = Omit<Schema['UserSettings']['createType'], 'id' | 'createdAt' | 'updatedAt'>
type UpdateSettingsInput = Schema['UserSettings']['updateType']

export const settingsKeys = {
  all: ['settings'] as const,
  user: (userId: string) => [...settingsKeys.all, userId] as const,
}

export function useUserSettings(userId: string) {
  return useQuery({
    queryKey: settingsKeys.user(userId),
    queryFn: async () => {
      const { data, errors } = await client.models.UserSettings.list({
        filter: { userId: { eq: userId } },
      })
      if (errors) throw new Error(errors[0].message)
      return data[0] ?? null
    },
    enabled: !!userId,
  })
}

export function useCreateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSettingsInput) => {
      const { data, errors } = await client.models.UserSettings.create(input)
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.userId) {
        queryClient.invalidateQueries({ queryKey: settingsKeys.user(data.userId) })
      }
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateSettingsInput & { id: string; userId: string }) => {
      const { data, errors } = await client.models.UserSettings.update(input)
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.userId) {
        queryClient.invalidateQueries({ queryKey: settingsKeys.user(data.userId) })
      }
    },
  })
}

export type { UserSettings, CreateSettingsInput, UpdateSettingsInput }
