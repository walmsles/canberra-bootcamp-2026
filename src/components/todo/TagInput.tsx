import { useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { TagBadge } from './TagBadge'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export function TagInput({ tags, onChange, placeholder = 'Add tags...', disabled }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onChange([...tags, trimmedTag])
    }
    setInputValue('')
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    } else if (e.key === ',' || e.key === ' ') {
      e.preventDefault()
      addTag(inputValue)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <TagBadge
            key={tag}
            tag={tag}
            onRemove={disabled ? undefined : () => removeTag(tag)}
          />
        ))}
      </div>
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) {
            addTag(inputValue)
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Add tag"
      />
      <p className="text-xs text-muted-foreground">
        Press Enter, comma, or space to add a tag
      </p>
    </div>
  )
}
