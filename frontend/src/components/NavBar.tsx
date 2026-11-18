import { NavLink } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'

const MENU: Record<Role, { to: string; label: string }[]> = {
  SOLICITANTE: [
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/mis-solicitudes', label: 'Mis solicitudes' },
  ],
  RESPONSABLE: [
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/gestion', label: 'Gestión' },
    { to: '/recursos/nuevo', label: 'Recursos' },
    { to: '/tablero', label: 'Tablero' },
  ],
  COORDINACION: [
    { to: '/tablero', label: 'Tablero' },
    { to: '/historial', label: 'Historial' },
  ],
}

export default function NavBar() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <header className="navbar">
      <strong className="brand">Préstamos</strong>
      <nav aria-label="Principal">
        {MENU[user.role].map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {i.label}
          </NavLink>
        ))}
      </nav>
      <div className="user">
        <span>
          {user.full_name} · {user.role}
        </span>
        <button onClick={logout}>Cerrar sesión</button>
      </div>
    </header>
  )
}
