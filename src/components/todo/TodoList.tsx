import { useState, useMemo } from 'react'
import { TodoItem } from './TodoItem'
import type { TodoItem as TodoItemType } from '@/hooks/use-todos'
import { TagBadge } from './TagBadge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { TodoListSkeleton } from './TodoSkeleton'

type SortOption = 'default' | 'tag' | 'dueDate' | 'priority'

interface TodoListProps {
  todos: TodoItemType[]
  onToggleComplete: (id: string, currentStatus: string) => void
  onDelete: (id: string) => void
  onStatusChange?: (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE') => void
  isLoading?: boolean
  canDeleteTodos?: boolean
  currentUserId?: string
  highlightTaskId?: string
}

export function TodoList({ todos, onToggleComplete, onDelete, onStatusChange, isLoading, canDeleteTodos = true, currentUserId, highlightTaskId }: TodoListProps) {
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('dueDate')

  // Get all unique tags from todos
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    todos.forEach(todo => {
      todo.tags?.forEach(tag => {
        if (tag !== null) tagSet.add(tag)
      })
    })
    return Array.from(tagSet).sort()
  }, [todos])

  // Filter and sort todos
  const filteredAndSortedTodos = useMemo(() => {
    let result = [...todos]

    // Filter by tag
    if (filterTag) {
      result = result.filter(todo => todo.tags?.includes(filterTag))
    }

    // Sort
    if (sortBy === 'tag') {
      result.sort((a, b) => {
        const aTag = a.tags?.[0] ?? ''
        const bTag = b.tags?.[0] ?? ''
        // Items without tags go last
        if (!aTag && bTag) return 1
        if (aTag && !bTag) return -1
        return aTag.localeCompare(bTag)
      })
    } else if (sortBy === 'dueDate') {
      result.sort((a, b) => {
        // Items without due dates go last
        if (!a.dueDate && b.dueDate) return 1
        if (a.dueDate && !b.dueDate) return -1
        if (!a.dueDate && !b.dueDate) return 0
        return new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      })
    } else if (sortBy === 'priority') {
      const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      result.sort((a, b) => {
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4
        return aPriority - bPriority
      })
    }

    return result
  }, [todos, filterTag, sortBy])

  if (isLoading) {
    return <TodoListSkeleton count={3} />
  }

  if (todos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No todos yet. Add one above!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Tag Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by tag:</span>
          {filterTag ? (
            <div className="flex items-center gap-1">
              <TagBadge tag={filterTag} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setFilterTag(null)}
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <select
              value=""
              onChange={(e) => setFilterTag(e.target.value || null)}
              className="text-sm border rounded px-2 py-1 bg-background"
              aria-label="Select tag to filter"
            >
              <option value="">All tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sort Option */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border rounded px-2 py-1 bg-background"
            aria-label="Sort option"
          >
            <option value="default">Default</option>
            <option value="dueDate">Due Date</option>
            <option value="priority">Priority</option>
            <option value="tag">Tag (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      {filterTag && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredAndSortedTodos.length} of {todos.length} todos
        </p>
      )}

      {/* Todo Items */}
      {filteredAndSortedTodos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No todos match the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAndSortedTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              canDelete={canDeleteTodos || todo.owner === currentUserId}
              highlight={todo.id === highlightTaskId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
