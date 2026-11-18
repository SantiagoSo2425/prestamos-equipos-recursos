import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import Icon from '../components/Icon'
import { useAuth } from './AuthContext'
import { HOME_BY_ROLE } from './roles'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="auth-shell">
      <aside className="auth-hero">
        <span className="brand">
          <span className="brand-mark">
            <Icon name="box" size={19} />
          </span>
          Préstamos
        </span>
        <div>
          <h1>Equipos y recursos, sin complicaciones.</h1>
          <p>
            Consulta la disponibilidad real, solicita en minutos y sigue cada préstamo desde la
            aprobación hasta la devolución.
          </p>
          <ul className="auth-points">
            <li>
              <span className="dot">
                <Icon name="calendar" size={16} />
              </span>
              Disponibilidad por fecha y hora
            </li>
            <li>
              <span className="dot">
                <Icon name="bolt" size={16} />
              </span>
              Solicitudes y aprobaciones ágiles
            </li>
            <li>
              <span className="dot">
                <Icon name="shield" size={16} />
              </span>
              Historial completo y trazable
            </li>
          </ul>
        </div>
        <small>Servicio de préstamo de equipos y recursos institucionales</small>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <h2>Bienvenido de nuevo</h2>
          <p className="muted">Inicia sesión con tu usuario institucional.</p>
          <form onSubmit={onSubmit} noValidate>
            <label>
              Usuario
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="usuario.institucional"
              />
            </label>
            <label>
              Contraseña
              <span className="input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                />
                <button
                  type="button"
                  className="reveal"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </span>
            </label>
            {error && (
              <div role="alert" className="alert alert-error" style={{ margin: 0 }}>
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </div>
            )}
            <button type="submit" className="primary" disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
