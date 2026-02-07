import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getCurrentUser, signOut, type AuthUser } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'

type AuthContextType = {
  user: AuthUser | null
  userId: string
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await signOut()
      setUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }, [])

  useEffect(() => {
    checkAuth()

    const hubListener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'tokenRefresh':
          checkAuth()
          break
        case 'signedOut':
          setUser(null)
          break
      }
    })

    return () => hubListener()
  }, [checkAuth])

  const value: AuthContextType = {
    user,
    userId: user?.userId ?? '',
    isLoading,
    isAuthenticated: !!user,
    logout,
    refreshAuth: checkAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
