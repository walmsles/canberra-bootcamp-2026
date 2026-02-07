import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const { isAuthenticated, isLoading } = useAuthContext()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Todo App</h1>
        <p className="text-muted-foreground max-w-md">
          Organize your tasks, collaborate with others, and never miss a deadline.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/signup">Create account</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
