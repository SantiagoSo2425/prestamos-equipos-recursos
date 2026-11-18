import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, clearSession, getStoredUser, saveSession } from '../api/client'
import type { Role, TokenOut, User } from '../api/types'

interface AuthContextValue {
  user: User | null
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  hasRole: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiFetch<TokenOut>('/auth/login', {
      method: 'POST',
      body: { username: username.trim(), password },
    })
    saveSession(data.access_token, data.user)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const hasRole = useCallback(
    (...roles: Role[]) => user !== null && roles.includes(user.role),
    [user],
  )

  const value = useMemo(() => ({ user, login, logout, hasRole }), [user, login, logout, hasRole])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
