import { useEffect, useCallback } from 'react'
import { reminderService } from '@/services/reminder-service'
import { useAllTodos, useUpdateTodo } from './use-todos'
import type { Schema } from '../../amplify/data/resource'

type TodoItem = Schema['TodoItem']['type']

export function useReminders(userId: string) {
  const { refetch } = useAllTodos(userId)
  const updateTodo = useUpdateTodo()

  const getTodos = useCallback(async (): Promise<TodoItem[]> => {
    const result = await refetch()
    return result.data ?? []
  }, [refetch])

  const handleReminder = useCallback((todo: TodoItem) => {
    // Show browser notification
    reminderService.showNotification(todo)

    // Mark reminder as sent in the database
    updateTodo.mutate({
      id: todo.id,
      reminderSent: true,
    })
  }, [updateTodo])

  useEffect(() => {
    if (!userId) return

    // Request notification permission on mount
    reminderService.requestPermission()

    // Start the reminder service
    reminderService.start(getTodos, handleReminder)

    return () => {
      reminderService.stop()
    }
  }, [userId, getTodos, handleReminder])

  return {
    requestPermission: () => reminderService.requestPermission(),
  }
}
