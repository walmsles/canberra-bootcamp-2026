import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagBadgeProps {
  tag: string
  onRemove?: () => void
  className?: string
}

export function TagBadge({ tag, onRemove, className }: TagBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn('gap-1 text-xs', className)}
    >
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
          aria-label={`Remove tag ${tag}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  )
}
