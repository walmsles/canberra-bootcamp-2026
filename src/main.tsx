import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'
import './index.css'
import { router } from './router'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './lib/auth-context'
import { ErrorBoundary } from './components/error-boundary'
import { Toaster } from './components/ui/toaster'

// Remove identity_pool_id completely to prevent Amplify from trying IAM auth
// The Identity Pool is misconfigured - we only need User Pool auth
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { identity_pool_id, unauthenticated_identities_enabled, ...authWithoutIdentityPool } = outputs.auth

Amplify.configure({
  ...outputs,
  auth: authWithoutIdentityPool,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
