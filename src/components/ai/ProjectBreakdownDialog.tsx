import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'
import { useBreakdownProject } from '@/hooks/use-ai-agents'
import { useCreateTodo } from '@/hooks/use-todos'

interface ProjectBreakdownDialogProps {
  listId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectBreakdownDialog({ listId, open, onOpenChange }: ProjectBreakdownDialogProps) {
  const [projectBrief, setProjectBrief] = useState('')
  const [deadline, setDeadline] = useState('')
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [isAdding, setIsAdding] = useState(false)

  const { breakdown, data, isLoading, error, reset } = useBreakdownProject()
  const createTodo = useCreateTodo()

  const handleSubmit = () => {
    const trimmed = projectBrief.trim()
    if (!trimmed) return
    reset()
    setSelectedIndices(new Set())
    breakdown(listId, trimmed, deadline || undefined)
  }

  const handleToggleTask = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (!data) return
    if (selectedIndices.size === data.tasks.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(data.tasks.map((_, i) => i)))
    }
  }

  const handleConfirm = async () => {
    if (!data || selectedIndices.size === 0) return
    setIsAdding(true)
    try {
      const selected = data.tasks.filter((_, i) => selectedIndices.has(i))
      for (const task of selected) {
        await createTodo.mutateAsync({
          title: task.title,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
          tags: task.tags,
          listId,
          status: 'PENDING',
        })
      }
      handleClose()
    } catch {
      // createTodo error state is handled by the hook
    } finally {
      setIsAdding(false)
    }
  }

  const handleClose = () => {
    setProjectBrief('')
    setDeadline('')
    setSelectedIndices(new Set())
    reset()
    onOpenChange(false)
  }

  const handleRetry = () => {
    reset()
    setSelectedIndices(new Set())
  }

  // Auto-select all tasks when data arrives
  const [lastData, setLastData] = useState(data)
  if (data && data !== lastData) {
    setLastData(data)
    setSelectedIndices(new Set(data.tasks.map((_, i) => i)))
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Breakdown</DialogTitle>
          <DialogDescription>
            Describe your project and the AI will break it into individual tasks.
          </DialogDescription>
        </DialogHeader>

        {!data && !isLoading && !error && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-brief">Project Brief</Label>
              <Input
                id="project-brief"
                placeholder="Describe your project..."
                value={projectBrief}
                onChange={(e) => setProjectBrief(e.target.value)}
                aria-label="Project brief"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-deadline">Deadline (optional)</Label>
              <Input
                id="project-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                aria-label="Project deadline"
              />
            </div>
          </div>
        )}

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
              Retry
            </Button>
          </div>
        )}

        {data && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{data.summary}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIndices.size} of {data.tasks.length} tasks selected
              </span>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedIndices.size === data.tasks.length ? 'Deselect all' : 'Select all'}
              </Button>
            </div>
            <ul className="space-y-2 max-h-60 overflow-y-auto" role="list">
              {data.tasks.map((task, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    checked={selectedIndices.has(index)}
                    onCheckedChange={() => handleToggleTask(index)}
                    aria-label={`Select "${task.title}"`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {!data && !isLoading && !error && (
            <Button onClick={handleSubmit} disabled={!projectBrief.trim()}>
              Break Down Project
            </Button>
          )}
          {data && (
            <Button
              onClick={handleConfirm}
              disabled={selectedIndices.size === 0 || isAdding}
            >
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add {selectedIndices.size} {selectedIndices.size === 1 ? 'Task' : 'Tasks'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
