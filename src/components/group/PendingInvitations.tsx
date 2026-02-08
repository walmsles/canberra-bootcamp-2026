import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Users } from 'lucide-react'
import type { GroupInvitation } from '@/hooks/use-groups'

interface PendingInvitationsProps {
  invitations: GroupInvitation[]
  onAccept: (invitationId: string, groupId: string) => void
  onDecline: (invitationId: string) => void
  isAccepting?: boolean
  isDeclining?: boolean
}

export function PendingInvitations({
  invitations,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
}: PendingInvitationsProps) {
  if (invitations.length === 0) {
    return null
  }

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Pending Invitations</CardTitle>
          <Badge variant="default">{invitations.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{invitation.groupName}</p>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ve been invited to join this group
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDecline(invitation.id)}
                  disabled={isAccepting || isDeclining}
                >
                  <X className="h-4 w-4 mr-1" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => onAccept(invitation.id, invitation.groupId)}
                  disabled={isAccepting || isDeclining}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
