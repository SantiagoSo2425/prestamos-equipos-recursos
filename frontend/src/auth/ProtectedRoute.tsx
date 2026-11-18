import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from './AuthContext'

interface Props {
  roles?: Role[]
  children: ReactNode
}

export default function ProtectedRoute({ roles, children }: Props) {
  const { user, hasRole } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (roles && !hasRole(...roles)) {
    return (
      <main role="alert">
        <h1>No autorizado</h1>
        <p>Tu rol no tiene permiso para ver esta página.</p>
      </main>
    )
  }
  return <>{children}</>
}
