import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuthContext } from '@/lib/auth-context'
import { useLists, useCreateList, useDeleteList, useReorderLists, type TodoList } from '@/hooks/use-lists'
import { useAllTodos, useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '@/hooks/use-todos'
import { useReminders } from '@/hooks/use-reminders'
import { usePendingInvitations, useOwnedGroups, useMemberGroups } from '@/hooks/use-groups'
import { TodoList as TodoListComponent, AddTodoForm } from '@/components/todo'
import { AddListForm } from '@/components/list'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { List, Plus, Trash2, Settings, Menu, X, Users, GripVertical } from 'lucide-react'

// Sortable list item component
interface SortableListItemProps {
  list: TodoList
  isSelected: boolean
  todoCount: number
  isOwner: boolean
  groupName?: string
  onSelect: (id: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}

function SortableListItem({ list, isSelected, todoCount, isOwner, groupName, onSelect, onDelete }: SortableListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isShared = !!list.groupId

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full flex items-center gap-1 px-2 py-2 rounded-md text-sm text-left transition-colors group",
        isSelected
          ? "bg-primary text-primary-foreground"
          : isShared
            ? "hover:bg-accent bg-accent/30"
            : "hover:bg-accent",
        isDragging && "opacity-50 z-50"
      )}
    >
      {isOwner && (
        <button
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent/50 touch-none",
            isSelected && "hover:bg-primary-foreground/20"
          )}
          aria-label={`Drag to reorder ${list.name}`}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <button
        onClick={() => onSelect(list.id)}
        className="flex items-center gap-2 flex-1 min-w-0"
      >
        {isShared ? (
          <Users className="h-4 w-4 shrink-0 text-blue-500" />
        ) : (
          <List className="h-4 w-4 shrink-0" />
        )}
        <div className="flex flex-col flex-1 min-w-0 text-left">
          <span className="truncate">{list.name}</span>
          {isShared && groupName && (
            <span className={cn(
              "text-xs truncate",
              isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {groupName}
            </span>
          )}
        </div>
        <span className="text-xs opacity-70">{todoCount}</span>
      </button>
      {isOwner && (
        <button
          onClick={(e) => onDelete(list.id, e)}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20",
            isSelected && "hover:bg-primary-foreground/20"
          )}
          aria-label={`Delete ${list.name}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function AppLayout() {
  const { user, userId, logout } = useAuthContext()
  const userEmail = user?.signInDetails?.loginId ?? ''
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [showAddList, setShowAddList] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Initialize reminders service
  useReminders(userId)

  // Fetch pending invitations for badge
  const { data: pendingInvitations = [] } = usePendingInvitations(userEmail)

  // Fetch groups for shared list names
  const { data: ownedGroups = [] } = useOwnedGroups(userId)
  const { data: memberGroups = [] } = useMemberGroups(userId)
  const allGroups = [...ownedGroups, ...memberGroups]

  // Create a map of groupId to group name
  const groupNameMap = new Map(allGroups.map(g => [g.id, g.name]))

  const { data: lists = [], isLoading: listsLoading } = useLists(userId)
  const { data: allTodos = [], isLoading: allTodosLoading } = useAllTodos(userId)
  const { data: listTodos = [], isLoading: listTodosLoading } = useTodos(selectedListId ?? '')

  const createList = useCreateList()
  const deleteList = useDeleteList()
  const reorderLists = useReorderLists()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = lists.findIndex((list) => list.id === active.id)
      const newIndex = lists.findIndex((list) => list.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedLists = arrayMove(lists, oldIndex, newIndex)
        
        // Update sort order for all affected lists
        const updates = reorderedLists.map((list, index) => ({
          id: list.id,
          sortOrder: index,
        }))

        reorderLists.mutate({ lists: updates, owner: userId })
      }
    }
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
            <Link to="/groups" className="hidden sm:block relative">
              <Button variant="ghost" size="icon-sm" aria-label="Groups">
                <Users className="h-4 w-4" />
              </Button>
              {pendingInvitations.length > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {pendingInvitations.length}
                </Badge>
              )}
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={lists.map(l => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="mt-2 space-y-1">
                    {lists.map(list => {
                      const count = allTodos.filter(t => t.listId === list.id).length
                      const isOwner = list.owner === userId
                      const groupName = list.groupId ? groupNameMap.get(list.groupId) : undefined
                      return (
                        <SortableListItem
                          key={list.id}
                          list={list}
                          isSelected={selectedListId === list.id}
                          todoCount={count}
                          isOwner={isOwner}
                          groupName={groupName}
                          onSelect={handleSelectList}
                          onDelete={handleDeleteList}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Mobile-only navigation links */}
            <div className="mt-4 pt-4 border-t md:hidden space-y-1">
              <Link
                to="/groups"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-accent"
                onClick={() => setSidebarOpen(false)}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="flex-1">Groups</span>
                {pendingInvitations.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {pendingInvitations.length}
                  </Badge>
                )}
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

              <TodoListComponent
                todos={todos}
                onToggleComplete={handleToggleComplete}
                onDelete={handleDeleteTodo}
                onStatusChange={handleStatusChange}
                isLoading={todosLoading}
                canDeleteTodos={selectedList ? selectedList.owner === userId : false}
                currentUserId={userId}
              />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
