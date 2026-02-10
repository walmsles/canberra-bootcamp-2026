import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarDays, Loader2, RotateCcw } from 'lucide-react'
import { usePlanDay } from '@/hooks/use-ai-agents'
import { useUpdateTodo } from '@/hooks/use-todos'

interface ListOption {
  id: string
  name: string
}

interface DailyPlanCardProps {
  lists: ListOption[]
}

export function DailyPlanCard({ lists }: DailyPlanCardProps) {
  const [selectedListId, setSelectedListId] = useState<string | undefined>(undefined)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const { plan, data, isLoading, error, reset } = usePlanDay()
  const { mutate: updateTodo } = useUpdateTodo()

  const handlePlanDay = () => {
    const today = new Date().toISOString().split('T')[0]
    plan(today, selectedListId)
  }

  const handleRetry = () => {
    reset()
  }

  const handleListChange = (value: string) => {
    setSelectedListId(value === 'all' ? undefined : value)
  }

  const handleToggleComplete = (taskId: string, isChecked: boolean) => {
    if (isChecked) {
      setCompletedTasks(prev => new Set(prev).add(taskId))
      updateTodo({ id: taskId, status: 'COMPLETE' })
    } else {
      setCompletedTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      updateTodo({ id: taskId, status: 'PENDING' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Daily Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handlePlanDay}
            disabled={isLoading}
            size="sm"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Plan My Day
          </Button>
          {lists.length > 0 && (
            <Select
              value={selectedListId ?? 'all'}
              onValueChange={handleListChange}
            >
              <SelectTrigger size="sm" aria-label="Filter by list">
                <SelectValue placeholder="All lists" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lists</SelectItem>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {error && (
          <div className="space-y-3">
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RotateCcw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        )}

        {data && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{data.summary}</p>
            <ul className="space-y-2" role="list">
              {data.tasks.map((task, index) => {
                const isCompleted = completedTasks.has(task.taskId)
                return (
                  <li
                    key={task.taskId || index}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={(checked) => handleToggleComplete(task.taskId, checked as boolean)}
                      aria-label={`Mark "${task.title}" as ${isCompleted ? 'incomplete' : 'complete'}`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {task.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{task.reasoning}</p>
                      {task.estimatedMinutes && (
                        <p className="text-xs text-muted-foreground">
                          ~{task.estimatedMinutes} min
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
