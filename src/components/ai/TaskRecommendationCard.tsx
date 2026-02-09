import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Lightbulb, Loader2, RotateCcw, ExternalLink } from 'lucide-react'
import { useRecommendTask } from '@/hooks/use-ai-agents'
import { useNavigate } from '@tanstack/react-router'

interface ListOption {
  id: string
  name: string
}

interface TaskRecommendationCardProps {
  lists: ListOption[]
}

export function TaskRecommendationCard({ lists }: TaskRecommendationCardProps) {
  const [selectedListId, setSelectedListId] = useState<string | undefined>(undefined)
  const { recommend, data, isLoading, error, reset } = useRecommendTask()
  const navigate = useNavigate()

  const handleRecommend = () => {
    recommend(selectedListId)
  }

  const handleRetry = () => {
    reset()
  }

  const handleListChange = (value: string) => {
    setSelectedListId(value === 'all' ? undefined : value)
  }

  const handleGoToTask = () => {
    if (!data) return
    const listId = data.listId ?? selectedListId
    if (listId) {
      navigate({
        to: '/dashboard',
        search: { selectList: listId, highlightTask: data.taskId },
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" />
          Task Recommendation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleRecommend}
            disabled={isLoading}
            size="sm"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            What Should I Do Next?
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
          <div className="rounded-md border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{data.title}</p>
              <Badge variant="outline" className="text-xs">
                {data.priority}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{data.reasoning}</p>
            {(data.listId ?? selectedListId) && (
              <button
                onClick={handleGoToTask}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Go to task
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
