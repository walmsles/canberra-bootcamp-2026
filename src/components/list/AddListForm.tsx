import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

interface AddListFormProps {
  onAdd: (name: string, description?: string) => void
  isLoading?: boolean
  compact?: boolean
}

export function AddListForm({ onAdd, isLoading, compact }: AddListFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('List name cannot be empty')
      return
    }

    onAdd(trimmedName, description.trim() || undefined)
    setName('')
    setDescription('')
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          type="text"
          placeholder="List name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          aria-label="List name"
          aria-invalid={!!error}
          disabled={isLoading}
          className="h-8 text-sm"
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <Button type="submit" disabled={isLoading} size="sm" className="w-full">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="New list name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
            aria-label="List name"
            aria-invalid={!!error}
            disabled={isLoading}
          />
          {error && (
            <p className="text-sm text-destructive mt-1">{error}</p>
          )}
        </div>
        <Button type="submit" disabled={isLoading}>
          <Plus className="h-4 w-4" />
          Add List
        </Button>
      </div>
      
      <Input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="List description"
        disabled={isLoading}
      />
    </form>
  )
}
