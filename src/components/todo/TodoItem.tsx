import { useEffect, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Trash2, Clock, Bell } from 'lucide-react'
import type { TodoItem as TodoItemType } from '@/hooks/use-todos'
import { cn } from '@/lib/utils'
import { TagBadge } from './TagBadge'

interface TodoItemProps {
  todo: TodoItemType
  onToggleComplete: (id: string, currentStatus: string) => void
  onDelete: (id: string) => void
  onStatusChange?: (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE') => void
  canDelete?: boolean
  highlight?: boolean
}

export function TodoItem({ todo, onToggleComplete, onDelete, onStatusChange, canDelete = true, highlight = false }: TodoItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isComplete = todo.status === 'COMPLETE'

  useEffect(() => {
    if (highlight && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlight])
  
  const formatDueDate = (dateString: string | null | undefined) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatReminderTime = (minutes: number | null | undefined) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes}m before`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h before`
    return `${Math.floor(minutes / 1440)}d before`
  }

  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'COMPLETE':
        return 'text-green-600'
      case 'IN_PROGRESS':
        return 'text-blue-600'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div
      ref={ref}
      className={cn(
      "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
      isComplete && "opacity-60",
      highlight && "ring-2 ring-primary"
    )}>
      <Checkbox
        checked={isComplete}
        onCheckedChange={() => onToggleComplete(todo.id, todo.status ?? 'PENDING')}
        aria-label={`Mark "${todo.title}" as ${isComplete ? 'incomplete' : 'complete'}`}
      />
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium truncate",
          isComplete && "line-through text-muted-foreground"
        )}>
          {todo.title}
        </p>
        
        {todo.description && (
          <p className="text-sm text-muted-foreground truncate">
            {todo.description}
          </p>
        )}
        
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {todo.dueDate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="due-date-badge">
              <Clock className="h-3 w-3" />
              {formatDueDate(todo.dueDate)}
            </span>
          )}

          {todo.reminderMinutes && todo.dueDate && !isComplete && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="reminder-badge">
              <Bell className="h-3 w-3" />
              {formatReminderTime(todo.reminderMinutes)}
            </span>
          )}
          
          {todo.status && (
            <span className={cn("text-xs font-medium", getStatusColor(todo.status))}>
              {todo.status.replace('_', ' ')}
            </span>
          )}
        </div>

        {todo.tags && todo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {todo.tags.filter((tag): tag is string => tag !== null).map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>

      {onStatusChange && !isComplete && (
        <select
          value={todo.status ?? 'PENDING'}
          onChange={(e) => onStatusChange(todo.id, e.target.value as 'PENDING' | 'IN_PROGRESS' | 'COMPLETE')}
          className="text-xs border rounded px-2 py-1 bg-background"
          aria-label="Change status"
        >
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETE">Complete</option>
        </select>
      )}

      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(todo.id)}
          aria-label={`Delete "${todo.title}"`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  )
}
