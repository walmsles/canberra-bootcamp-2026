import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/auth-context'
import { useList, useDeleteList } from '@/hooks/use-lists'
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '@/hooks/use-todos'
import { TodoList, AddTodoForm } from '@/components/todo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'

export const Route = createFileRoute('/lists/$listId')({
  component: () => (
    <AuthGuard>
      <ListDetailPage />
    </AuthGuard>
  ),
})

function ListDetailPage() {
  const { listId } = Route.useParams()
  const navigate = useNavigate()
  const { user, userId, logout } = useAuthContext()
  
  const { data: list, isLoading: listLoading, error: listError } = useList(listId)
  const { data: todos = [], isLoading: todosLoading, error: todosError } = useTodos(listId)
  
  const deleteList = useDeleteList()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()

  if (listLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (listError || !list) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">
            {listError?.message || 'List not found'}
          </p>
          <Link to="/lists">
            <Button variant="outline">Back to Lists</Button>
          </Link>
        </div>
      </div>
    )
  }

  const handleAddTodo = (title: string, description?: string, tags?: string[], dueDate?: string, reminderMinutes?: number) => {
    createTodo.mutate({
      title,
      description,
      tags,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      reminderMinutes,
      listId,
      status: 'PENDING',
    })
  }

  const handleToggleComplete = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'COMPLETE' ? 'PENDING' : 'COMPLETE'
    updateTodo.mutate({
      id,
      status: newStatus,
    })
  }

  const handleStatusChange = (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE') => {
    updateTodo.mutate({
      id,
      status,
    })
  }

  const handleDeleteTodo = (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (todo) {
      deleteTodo.mutate({
        id,
        listId: todo.listId,
        owner: todo.owner ?? userId,
      })
    }
  }

  const handleDeleteList = () => {
    if (confirm('Are you sure you want to delete this list? All todos in this list will also be deleted.')) {
      deleteList.mutate(
        { id: listId, owner: userId },
        {
          onSuccess: () => {
            navigate({ to: '/lists' })
          },
        }
      )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Link to="/lists">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-xl md:text-2xl font-bold truncate">{list.name}</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <Button 
              variant="ghost" 
              size="icon-sm" 
              onClick={handleDeleteList}
              aria-label="Delete list"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline truncate max-w-[100px] md:max-w-none">
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
            <CardTitle>{list.name}</CardTitle>
            {list.description && (
              <p className="text-sm text-muted-foreground">{list.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <AddTodoForm 
              onAdd={handleAddTodo} 
              isLoading={createTodo.isPending} 
            />

            {todosError && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p>Error loading todos: {todosError.message}</p>
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

            {createTodo.isError && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p>Error creating todo: {createTodo.error.message}</p>
              </div>
            )}

            <TodoList
              todos={todos}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTodo}
              onStatusChange={handleStatusChange}
              isLoading={todosLoading}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
