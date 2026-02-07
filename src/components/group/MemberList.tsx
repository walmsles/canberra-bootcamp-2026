import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserMinus, Crown } from 'lucide-react'

interface MemberListProps {
  memberIds: string[]
  ownerId: string
  currentUserId: string
  onRevoke: (memberId: string) => void
  isLoading?: boolean
}

export function MemberList({
  memberIds,
  ownerId,
  currentUserId,
  onRevoke,
  isLoading,
}: MemberListProps) {
  const isOwner = currentUserId === ownerId
  const allMembers = [ownerId, ...memberIds.filter((id) => id !== ownerId)]

  if (allMembers.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p>No members yet. Invite someone to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {allMembers.map((memberId) => {
        const isMemberOwner = memberId === ownerId
        const isCurrentUser = memberId === currentUserId

        return (
          <div
            key={memberId}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {isMemberOwner ? (
                  <Crown className="h-4 w-4 text-primary" />
                ) : (
                  <span className="text-sm font-medium text-primary">
                    {memberId.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isCurrentUser ? 'You' : `User ${memberId.slice(0, 8)}...`}
                </p>
                <div className="flex items-center gap-2">
                  {isMemberOwner ? (
                    <Badge variant="default" className="text-xs">
                      Owner
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Member
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {isOwner && !isMemberOwner && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onRevoke(memberId)}
                disabled={isLoading}
                aria-label={`Remove member ${memberId}`}
              >
                <UserMinus className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
