import { Navigate } from '@tanstack/react-router'
import { useAuthContext } from '@/lib/auth-context'

type AuthGuardProps = {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, userId } = useAuthContext()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated || !userId) {
    return <Navigate to="/login" />
  }

  return <>{children}</>
}
