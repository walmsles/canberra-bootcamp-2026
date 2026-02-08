import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Bell, Wand2 } from 'lucide-react'
import { TagInput } from './TagInput'
import { useAnalyzeTask } from '@/hooks/use-ai-agents'
import { mapAnalyzerPriority } from '@/lib/ai-response-parser'

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

interface AddTodoFormProps {
  onAdd: (title: string, description?: string, tags?: string[], dueDate?: string, reminderMinutes?: number, priority?: Priority) => void
  isLoading?: boolean
  defaultReminderMinutes?: number
}

const REMINDER_OPTIONS = [
  { value: '0', label: 'No reminder' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
  { value: '2880', label: '2 days before' },
  { value: '10080', label: '1 week before' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

export function AddTodoForm({ onAdd, isLoading, defaultReminderMinutes = 1440 }: AddTodoFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [reminderMinutes, setReminderMinutes] = useState<string>(String(defaultReminderMinutes))
  const [error, setError] = useState<string | null>(null)

  const { analyze, data: aiData, isLoading: aiLoading, error: aiError, reset: resetAi } = useAnalyzeTask()

  // Pre-fill form fields when AI returns data
  const [lastAppliedAi, setLastAppliedAi] = useState<typeof aiData>(null)
  if (aiData && aiData !== lastAppliedAi) {
    setLastAppliedAi(aiData)
    setPriority(mapAnalyzerPriority(aiData.priority))
    if (aiData.tags.length > 0) setTags(aiData.tags)
    if (aiData.dueDate) setDueDate(aiData.dueDate)
  }

  const handleAiAssist = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    resetAi()
    setLastAppliedAi(null)
    analyze(trimmed)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Todo title cannot be empty')
      return
    }

    const reminder = reminderMinutes !== '0' ? parseInt(reminderMinutes, 10) : undefined

    onAdd(
      trimmedTitle,
      description.trim() || undefined,
      tags.length > 0 ? tags : undefined,
      dueDate || undefined,
      reminder,
      priority || undefined
    )
    setTitle('')
    setDescription('')
    setTags([])
    setDueDate('')
    setPriority('')
    setReminderMinutes(String(defaultReminderMinutes))
    resetAi()
    setLastAppliedAi(null)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (error) setError(null)
            }}
            aria-label="Todo title"
            aria-invalid={!!error}
            disabled={isLoading}
          />
          {error && (
            <p className="text-sm text-destructive mt-1">{error}</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAiAssist}
          disabled={isLoading || aiLoading || !title.trim()}
          aria-label="AI assist"
        >
          <Wand2 className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
        </Button>
        <Button type="submit" disabled={isLoading}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {aiError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {aiError}
        </div>
      )}
      
      <Input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Todo description"
        disabled={isLoading}
      />

      <TagInput
        tags={tags}
        onChange={setTags}
        placeholder="Add tags (optional)"
        disabled={isLoading}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="priority" className="text-sm text-muted-foreground">
            Priority
          </Label>
          <Select
            value={priority}
            onValueChange={(val) => setPriority(val as Priority)}
            disabled={isLoading}
          >
            <SelectTrigger id="priority" aria-label="Priority">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="dueDate" className="text-sm text-muted-foreground">
            Due date
          </Label>
          <Input
            id="dueDate"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Due date"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="reminder" className="text-sm text-muted-foreground flex items-center gap-1">
            <Bell className="h-3 w-3" />
            Reminder
          </Label>
          <Select
            value={reminderMinutes}
            onValueChange={setReminderMinutes}
            disabled={isLoading || !dueDate}
          >
            <SelectTrigger id="reminder" aria-label="Reminder time">
              <SelectValue placeholder="Select reminder" />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </form>
  )
}
