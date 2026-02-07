import type { Schema } from '../../amplify/data/resource'

type TodoItem = Schema['TodoItem']['type']

export class ReminderService {
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private notifiedTodos: Set<string> = new Set()

  start(
    getTodos: () => Promise<TodoItem[]>,
    onReminder: (todo: TodoItem) => void
  ) {
    // Check every minute
    this.checkInterval = setInterval(async () => {
      try {
        const todos = await getTodos()
        const now = new Date()

        for (const todo of todos) {
          if (this.shouldNotify(todo, now)) {
            this.notifiedTodos.add(todo.id)
            onReminder(todo)
          }
        }
      } catch (error) {
        console.error('Error checking reminders:', error)
      }
    }, 60000)
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  clearNotified(todoId: string) {
    this.notifiedTodos.delete(todoId)
  }

  shouldNotify(todo: TodoItem, now: Date): boolean {
    // Don't notify if no due date
    if (!todo.dueDate) return false

    // Don't notify completed todos
    if (todo.status === 'COMPLETE') return false

    // Don't notify if already notified
    if (this.notifiedTodos.has(todo.id)) return false

    // Don't notify if reminder already sent (persisted)
    if (todo.reminderSent) return false

    const dueDate = new Date(todo.dueDate)
    const reminderMinutes = todo.reminderMinutes ?? 1440 // Default 24 hours
    const reminderTime = new Date(dueDate.getTime() - reminderMinutes * 60000)

    // Notify if current time is past reminder time but before due date
    return now >= reminderTime && now < dueDate
  }

  calculateReminderTime(todo: TodoItem): Date | null {
    if (!todo.dueDate) return null

    const dueDate = new Date(todo.dueDate)
    const reminderMinutes = todo.reminderMinutes ?? 1440
    return new Date(dueDate.getTime() - reminderMinutes * 60000)
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false

    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  showNotification(todo: TodoItem) {
    if (Notification.permission !== 'granted') return

    const dueDate = todo.dueDate ? new Date(todo.dueDate).toLocaleString() : 'No due date'

    new Notification(`Reminder: ${todo.title}`, {
      body: todo.description || `Due: ${dueDate}`,
      icon: '/vite.svg',
      tag: todo.id,
    })
  }
}

export const reminderService = new ReminderService()

// Helper function for calculating reminder time (used in tests)
export function calculateReminderTime(todo: { dueDate?: string | null; reminderMinutes?: number | null }): Date | null {
  if (!todo.dueDate) return null

  const dueDate = new Date(todo.dueDate)
  const reminderMinutes = todo.reminderMinutes ?? 1440
  return new Date(dueDate.getTime() - reminderMinutes * 60000)
}

// Helper function for checking if reminder should fire (used in tests)
export function shouldFireReminder(
  todo: { dueDate?: string | null; reminderMinutes?: number | null; status?: string | null },
  now: Date
): boolean {
  if (!todo.dueDate) return false
  if (todo.status === 'COMPLETE') return false

  const dueDate = new Date(todo.dueDate)
  const reminderMinutes = todo.reminderMinutes ?? 1440
  const reminderTime = new Date(dueDate.getTime() - reminderMinutes * 60000)

  return now >= reminderTime && now < dueDate
}
