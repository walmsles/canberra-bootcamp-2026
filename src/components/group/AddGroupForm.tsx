import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

interface AddGroupFormProps {
  onAdd: (name: string, description?: string) => void
  isLoading?: boolean
}

export function AddGroupForm({ onAdd, isLoading }: AddGroupFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Group name cannot be empty')
      return
    }

    onAdd(trimmedName, description.trim() || undefined)
    setName('')
    setDescription('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="New group name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
            aria-label="Group name"
            aria-invalid={!!error}
            disabled={isLoading}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
        <Button type="submit" disabled={isLoading}>
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      </div>

      <Input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Group description"
        disabled={isLoading}
      />
    </form>
  )
}
