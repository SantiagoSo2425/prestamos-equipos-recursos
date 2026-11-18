import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'

interface Props {
  title: string
  subtitle?: string
  actions?: ReactNode
  /** Enlace «volver» opcional sobre el título. */
  back?: { to: string; label: string }
}

/** Cabecera uniforme de página: título, descripción breve y acciones principales. */
export default function PageHeader({ title, subtitle, actions, back }: Props) {
  return (
    <>
      {back && (
        <Link to={back.to} className="back-link">
          <Icon name="arrowLeft" size={16} /> {back.label}
        </Link>
      )}
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </header>
    </>
  )
}
