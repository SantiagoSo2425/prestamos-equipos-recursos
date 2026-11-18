import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from './AuthContext'
import { HOME_BY_ROLE } from './roles'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Ingresa tu usuario y contraseña.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const u = await login(username, password)
      navigate(HOME_BY_ROLE[u.role], { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <h1>Préstamo de equipos y recursos</h1>
      <form onSubmit={onSubmit} noValidate>
        <label>
          Usuario
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}
