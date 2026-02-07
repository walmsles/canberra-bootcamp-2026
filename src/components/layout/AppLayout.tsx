import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/auth-context'
import { useLists, useCreateList, useDeleteList } from '@/hooks/use-lists'
import { useAllTodos, useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '@/hooks/use-todos'
import { useReminders } from '@/hooks/use-reminders'
import { TodoList, AddTodoForm } from '@/components/todo'
import { AddListForm } from '@/components/list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { List, Plus, Trash2, Settings, Menu, X, Users } from 'lucide-react'

export function AppLayout() {
  const { user, userId, logout } = useAuthContext()
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [showAddList, setShowAddList] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Initialize reminders service
  useReminders(userId)

  const { data: lists = [], isLoading: listsLoading } = useLists(userId)
  const { data: allTodos = [], isLoading: allTodosLoading } = useAllTodos(userId)
  const { data: listTodos = [], isLoading: listTodosLoading } = useTodos(selectedListId ?? '')

  const createList = useCreateList()
  const deleteList = useDeleteList()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()

  // Determine which todos to show
  const todos = selectedListId ? listTodos : allTodos
  const todosLoading = selectedListId ? listTodosLoading : allTodosLoading
  const selectedList = selectedListId ? lists.find(l => l.id === selectedListId) : null

  const handleAddList = (name: string, description?: string) => {
    createList.mutate(
      { name, description },
      { onSuccess: () => setShowAddList(false) }
    )
  }

  const handleDeleteList = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this list and all its todos?')) {
      deleteList.mutate(
        { id, owner: userId },
        { onSuccess: () => selectedListId === id && setSelectedListId(null) }
      )
    }
  }

  const handleAddTodo = (title: string, description?: string, tags?: string[], dueDate?: string, reminderMinutes?: number) => {
    if (!selectedListId) {
      // Can't add to "All" - need to select a list first
      alert('Please select a list first to add a todo')
      return
    }
    createTodo.mutate({
      title,
      description,
      tags,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      reminderMinutes,
      listId: selectedListId,
      status: 'PENDING',
    })
  }

  const handleToggleComplete = (id: string, currentStatus: string) => {
    updateTodo.mutate({
      id,
      status: currentStatus === 'COMPLETE' ? 'PENDING' : 'COMPLETE',
    })
  }

  const handleStatusChange = (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE') => {
    updateTodo.mutate({ id, status })
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

  const handleSelectList = (listId: string | null) => {
    setSelectedListId(listId)
    setSidebarOpen(false) // Close sidebar on mobile after selection
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b shrink-0">
        <div className="px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="text-xl md:text-2xl font-bold">Todo App</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline truncate max-w-[150px] md:max-w-none">
              {user?.signInDetails?.loginId}
            </span>
            <Link to="/groups" className="hidden sm:block">
              <Button variant="ghost" size="icon-sm" aria-label="Groups">
                <Users className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="icon-sm" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={logout} className="text-xs md:text-sm">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed md:relative inset-y-0 left-0 z-50 w-64 border-r bg-background md:bg-muted/30 flex flex-col transform transition-transform duration-200 ease-in-out md:transform-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            "top-[57px] md:top-0 h-[calc(100vh-57px)] md:h-auto"
          )}
        >
          <div className="p-4 border-b flex items-center justify-between">
            <span className="font-medium text-sm">Lists</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowAddList(!showAddList)}
              aria-label="Add list"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showAddList && (
            <div className="p-3 border-b">
              <AddListForm
                onAdd={handleAddList}
                isLoading={createList.isPending}
                compact
              />
            </div>
          )}

          <nav className="flex-1 overflow-y-auto p-2">
            {/* All todos option */}
            <button
              onClick={() => handleSelectList(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
                selectedListId === null
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
            >
              <List className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">All</span>
              <span className="text-xs opacity-70">{allTodos.length}</span>
            </button>

            {/* List items */}
            {listsLoading ? (
              <div className="space-y-2 mt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                {lists.map(list => {
                  const count = allTodos.filter(t => t.listId === list.id).length
                  return (
                    <div
                      key={list.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectList(list.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSelectList(list.id)
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors group cursor-pointer",
                        selectedListId === list.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      <List className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">{list.name}</span>
                      <span className="text-xs opacity-70">{count}</span>
                      <button
                        onClick={(e) => handleDeleteList(list.id, e)}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20",
                          selectedListId === list.id && "hover:bg-primary-foreground/20"
                        )}
                        aria-label={`Delete ${list.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Mobile-only navigation links */}
            <div className="mt-4 pt-4 border-t md:hidden space-y-1">
              <Link
                to="/groups"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-accent"
                onClick={() => setSidebarOpen(false)}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span>Groups</span>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">
                {selectedList ? selectedList.name : 'All Todos'}
              </CardTitle>
              {selectedList?.description && (
                <p className="text-sm text-muted-foreground">{selectedList.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              {selectedListId ? (
                <AddTodoForm
                  onAdd={handleAddTodo}
                  isLoading={createTodo.isPending}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a list to add new todos
                </p>
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
    </div>
  )
}
