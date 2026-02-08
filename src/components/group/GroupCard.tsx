import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, ChevronRight, Users } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { ListGroup } from '@/hooks/use-groups'
import { cn } from '@/lib/utils'

interface GroupCardProps {
  group: ListGroup
  onDelete?: (id: string) => void
  isOwner: boolean
}

export function GroupCard({ group, onDelete, isOwner }: GroupCardProps) {
  const navigate = useNavigate()
  const memberCount = group.memberIds?.length ?? 0

  const handleNavigate = () => {
    navigate({ to: '/groups/$groupId', params: { groupId: group.id } })
  }

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{group.name}</CardTitle>
            {isOwner ? (
              <Badge variant="default">Owner</Badge>
            ) : (
              <Badge variant="secondary">Member</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOwner && onDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(group.id)
                }}
                aria-label={`Delete "${group.name}"`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon-sm" 
              onClick={handleNavigate}
              aria-label={`View "${group.name}"`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p
          className={cn('text-sm text-muted-foreground', !group.description && 'italic')}
        >
          {group.description || 'No description'}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <Users className="h-3 w-3" />
          <span>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
