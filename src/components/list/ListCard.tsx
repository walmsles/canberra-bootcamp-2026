import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, ChevronRight, Sparkles } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { TodoList } from '@/hooks/use-lists'
import { cn } from '@/lib/utils'
import { ProjectBreakdownDialog } from '@/components/ai/ProjectBreakdownDialog'

interface ListCardProps {
  list: TodoList
  onDelete: (id: string) => void
  todoCount?: number
}

export function ListCard({ list, onDelete, todoCount = 0 }: ListCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  return (
    <>
      <Card className="hover:bg-accent/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{list.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault()
                  setBreakdownOpen(true)
                }}
                aria-label={`Break down project for "${list.name}"`}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault()
                  onDelete(list.id)
                }}
                aria-label={`Delete "${list.name}"`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Link to="/lists/$listId" params={{ listId: list.id }}>
                <Button variant="ghost" size="icon-sm" aria-label={`View "${list.name}"`}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className={cn(
            "text-sm text-muted-foreground",
            !list.description && "italic"
          )}>
            {list.description || 'No description'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {todoCount} {todoCount === 1 ? 'todo' : 'todos'}
          </p>
        </CardContent>
      </Card>

      <ProjectBreakdownDialog
        listId={list.id}
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
      />
    </>
  )
}
