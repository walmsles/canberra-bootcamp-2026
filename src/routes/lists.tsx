import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/auth-context'
import { useLists, useCreateList, useDeleteList } from '@/hooks/use-lists'
import { ListCard, AddListForm, ListGridSkeleton } from '@/components/list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'

export const Route = createFileRoute('/lists')({
  component: () => (
    <AuthGuard>
      <ListsPage />
    </AuthGuard>
  ),
})

function ListsPage() {
  const { user, userId, logout } = useAuthContext()
  
  const { data: lists = [], isLoading: listsLoading, error } = useLists(userId)
  const createList = useCreateList()
  const deleteList = useDeleteList()

  const handleAddList = (name: string, description?: string) => {
    createList.mutate({
      name,
      description,
    })
  }

  const handleDeleteList = (id: string) => {
    if (confirm('Are you sure you want to delete this list? All todos in this list will also be deleted.')) {
      deleteList.mutate({ id, owner: userId })
    }
  }

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
            <h1 className="text-xl md:text-2xl font-bold">My Lists</h1>
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Todo Lists</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AddListForm 
              onAdd={handleAddList} 
              isLoading={createList.isPending} 
            />

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p>Error loading lists: {error.message}</p>
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

            {createList.isError && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p>Error creating list: {createList.error.message}</p>
              </div>
            )}

            {deleteList.isError && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p>Error deleting list: {deleteList.error.message}</p>
              </div>
            )}

            {listsLoading ? (
              <ListGridSkeleton count={4} />
            ) : lists.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No lists yet. Create one above!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {lists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    onDelete={handleDeleteList}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
