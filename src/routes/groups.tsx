import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/auth-context'
import {
  useOwnedGroups,
  useMemberGroups,
  useCreateGroup,
  useDeleteGroup,
} from '@/hooks/use-groups'
import { GroupCard, AddGroupForm } from '@/components/group'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'

export const Route = createFileRoute('/groups')({
  component: () => (
    <AuthGuard>
      <GroupsPage />
    </AuthGuard>
  ),
})

function GroupsPage() {
  const { user, userId, logout } = useAuthContext()

  const { data: ownedGroups = [], isLoading: ownedLoading, error: ownedError } = useOwnedGroups(userId)
  const { data: memberGroups = [], isLoading: memberLoading, error: memberError } = useMemberGroups(userId)
  const createGroup = useCreateGroup()
  const deleteGroup = useDeleteGroup()

  const handleAddGroup = (name: string, description?: string) => {
    createGroup.mutate({
      name,
      description,
      memberIds: [],
    })
  }

  const handleDeleteGroup = (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this group? All members will lose access to shared lists.'
      )
    ) {
      deleteGroup.mutate({ id, owner: userId })
    }
  }

  const isLoading = ownedLoading || memberLoading
  const error = ownedError || memberError

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-xl md:text-2xl font-bold">Groups</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline truncate max-w-[150px] md:max-w-none">
              {user?.signInDetails?.loginId}
            </span>
            <Button variant="outline" size="sm" onClick={logout} className="text-xs md:text-sm">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Create Group Section */}
        <Card>
          <CardHeader>
            <CardTitle>Create a Group</CardTitle>
          </CardHeader>
          <CardContent>
            <AddGroupForm onAdd={handleAddGroup} isLoading={createGroup.isPending} />

            {createGroup.isError && (
              <div className="mt-4 p-4 rounded-lg bg-destructive/10 text-destructive">
                <p>Error creating group: {createGroup.error.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
            <p>Error loading groups: {error.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        )}

        {deleteGroup.isError && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
            <p>Error deleting group: {deleteGroup.error.message}</p>
          </div>
        )}

        {/* My Groups Section */}
        <Card>
          <CardHeader>
            <CardTitle>My Groups</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 rounded-lg border bg-muted animate-pulse" />
                ))}
              </div>
            ) : ownedGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>You haven&apos;t created any groups yet.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {ownedGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onDelete={handleDeleteGroup}
                    isOwner={true}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Groups I'm a Member Of */}
        <Card>
          <CardHeader>
            <CardTitle>Groups I&apos;m a Member Of</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 rounded-lg border bg-muted animate-pulse" />
                ))}
              </div>
            ) : memberGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>You haven&apos;t been invited to any groups yet.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {memberGroups.map((group) => (
                  <GroupCard key={group.id} group={group} isOwner={false} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
