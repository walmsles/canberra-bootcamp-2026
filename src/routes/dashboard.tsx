import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth-guard'
import { AppLayout } from '@/components/layout'

export const Route = createFileRoute('/dashboard')({
  component: () => (
    <AuthGuard>
      <AppLayout />
    </AuthGuard>
  ),
})
