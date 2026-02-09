import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth-guard'
import { AppLayout } from '@/components/layout'

export const Route = createFileRoute('/dashboard')({
  validateSearch: (search: Record<string, unknown>): { selectList?: string; highlightTask?: string } => ({
    selectList: (search.selectList as string) || undefined,
    highlightTask: (search.highlightTask as string) || undefined,
  }),
  component: DashboardPage,
})

function DashboardPage() {
  const { selectList, highlightTask } = Route.useSearch()
  return (
    <AuthGuard>
      <AppLayout
        key={`${selectList ?? ''}-${highlightTask ?? ''}`}
        initialListId={selectList}
        highlightTaskId={highlightTask}
      />
    </AuthGuard>
  )
}
