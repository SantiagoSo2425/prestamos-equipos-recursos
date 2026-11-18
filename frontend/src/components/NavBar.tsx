import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import Icon, { type IconName } from './Icon'

const MENU: Record<Role, { to: string; label: string; icon: IconName }[]> = {
  SOLICITANTE: [
    { to: '/catalogo', label: 'Catálogo', icon: 'catalog' },
    { to: '/mis-solicitudes', label: 'Mis solicitudes', icon: 'requests' },
  ],
  RESPONSABLE: [
    { to: '/catalogo', label: 'Catálogo', icon: 'catalog' },
    { to: '/gestion', label: 'Gestión', icon: 'inbox' },
    { to: '/recursos/nuevo', label: 'Recursos', icon: 'box' },
    { to: '/tablero', label: 'Tablero', icon: 'dashboard' },
  ],
  COORDINACION: [
    { to: '/tablero', label: 'Tablero', icon: 'dashboard' },
    { to: '/historial', label: 'Historial', icon: 'history' },
  ],
}

const ROLE_LABEL: Record<Role, string> = {
  SOLICITANTE: 'Solicitante',
  RESPONSABLE: 'Responsable',
  COORDINACION: 'Coordinación',
}

function initials(name: string): string {
  const parts = name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export default function NavBar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null

  return (
    <header className={`navbar${open ? ' open' : ''}`}>
      <span className="brand">
        <span className="brand-mark">
          <Icon name="box" size={19} />
        </span>
        Préstamos
      </span>
      <button
        className="ghost nav-toggle"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={open ? 'close' : 'menu'} size={22} />
      </button>
      <nav aria-label="Principal" onClick={() => setOpen(false)}>
        {MENU[user.role].map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={i.icon} size={17} />
            {i.label}
          </NavLink>
        ))}
      </nav>
      <div className="user">
        <span className="avatar" aria-hidden="true">
          {initials(user.full_name)}
        </span>
        <span className="user-meta">
          <span>{user.full_name.replace(/\s*\(demo\)/i, '')}</span>
          <small>{ROLE_LABEL[user.role]}</small>
        </span>
        <button className="ghost sm" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </header>
  )
}
