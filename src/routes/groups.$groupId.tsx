import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/auth-context'
import {
  useGroup,
  useDeleteGroup,
  useInviteMember,
  useRevokeMember,
  useGroupInvitations,
} from '@/hooks/use-groups'
import { useLists, useUpdateList } from '@/hooks/use-lists'
import { InviteMemberDialog, MemberList } from '@/components/group'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trash2, Share2, X } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'

export const Route = createFileRoute('/groups/$groupId')({
  component: () => (
    <AuthGuard>
      <GroupDetailPage />
    </AuthGuard>
  ),
})

function GroupDetailPage() {
  const { groupId } = Route.useParams()
  const navigate = useNavigate()
  const { user, userId, logout } = useAuthContext()

  const { data: group, isLoading: groupLoading, error: groupError } = useGroup(groupId)
  const { data: invitations = [] } = useGroupInvitations(groupId)
  const { data: userLists = [] } = useLists(userId)

  const deleteGroup = useDeleteGroup()
  const inviteMember = useInviteMember()
  const revokeMember = useRevokeMember()
  const updateList = useUpdateList()

  const isOwner = group?.owner === userId

  // Filter lists that are shared with this group
  const sharedLists = userLists.filter((list) => list.groupId === groupId)
  // Filter lists that can be shared (owned by user and not already shared)
  const availableLists = userLists.filter((list) => !list.groupId)

  if (groupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (groupError || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{groupError?.message || 'Group not found'}</p>
          <Link to="/groups">
            <Button variant="outline">Back to Groups</Button>
          </Link>
        </div>
      </div>
    )
  }

  const handleDeleteGroup = () => {
    if (
      confirm(
        'Are you sure you want to delete this group? All members will lose access to shared lists.'
      )
    ) {
      deleteGroup.mutate(
        { id: groupId, owner: userId },
        {
          onSuccess: () => {
            navigate({ to: '/groups' })
          },
        }
      )
    }
  }

  const handleInviteMember = (email: string) => {
    inviteMember.mutate({
      groupId,
      groupName: group.name,
      invitedEmail: email,
      invitedBy: userId,
      status: 'PENDING',
    })
  }

  const handleRevokeMember = (memberId: string) => {
    if (confirm('Are you sure you want to remove this member from the group?')) {
      revokeMember.mutate({
        groupId,
        memberId,
        currentUserId: userId,
      })
    }
  }

  const handleShareList = (listId: string) => {
    updateList.mutate({
      id: listId,
      groupId,
    })
  }

  const handleUnshareList = (listId: string) => {
    updateList.mutate({
      id: listId,
      groupId: null,
    })
  }

  const pendingInvitations = invitations.filter((inv) => inv.status === 'PENDING')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Link to="/groups">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">{group.name}</h1>
              {isOwner ? (
                <Badge variant="default" className="shrink-0">Owner</Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0">Member</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {isOwner && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDeleteGroup}
                aria-label="Delete group"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline truncate max-w-[100px] md:max-w-none">
              {user?.signInDetails?.loginId}
            </span>
            <Button variant="outline" size="sm" onClick={logout} className="text-xs md:text-sm">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Group Info */}
        {group.description && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">{group.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Error Messages */}
        {inviteMember.isError && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
            <p>Error sending invitation: {inviteMember.error.message}</p>
          </div>
        )}

        {revokeMember.isError && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
            <p>Error removing member: {revokeMember.error.message}</p>
          </div>
        )}

        {/* Members Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Members</CardTitle>
            {isOwner && (
              <InviteMemberDialog
                groupName={group.name}
                onInvite={handleInviteMember}
                isLoading={inviteMember.isPending}
              />
            )}
          </CardHeader>
          <CardContent>
            <MemberList
              memberIds={(group.memberIds ?? []).filter((id): id is string => id !== null)}
              ownerId={group.owner ?? ''}
              currentUserId={userId}
              onRevoke={handleRevokeMember}
              isLoading={revokeMember.isPending}
            />
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {isOwner && pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="text-sm font-medium">{invitation.invitedEmail}</p>
                      <Badge variant="outline" className="text-xs">
                        Pending
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shared Lists Section */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle>Shared Lists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Currently Shared Lists */}
              {sharedLists.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Currently shared with this group:
                  </p>
                  {sharedLists.map((list) => (
                    <div
                      key={list.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div>
                        <p className="text-sm font-medium">{list.name}</p>
                        {list.description && (
                          <p className="text-xs text-muted-foreground">{list.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnshareList(list.id)}
                        disabled={updateList.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Unshare
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Available Lists to Share */}
              {availableLists.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Available lists to share:
                  </p>
                  {availableLists.map((list) => (
                    <div
                      key={list.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div>
                        <p className="text-sm font-medium">{list.name}</p>
                        {list.description && (
                          <p className="text-xs text-muted-foreground">{list.description}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareList(list.id)}
                        disabled={updateList.isPending}
                      >
                        <Share2 className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {sharedLists.length === 0 && availableLists.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No lists available. Create a list first to share it with this group.</p>
                  <Link to="/lists" className="mt-2 inline-block">
                    <Button variant="outline" size="sm">
                      Go to Lists
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
