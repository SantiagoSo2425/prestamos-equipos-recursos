import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

interface Props {
  icon?: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
}

/** Estado vacío amable: explica qué falta y qué hacer a continuación. */
export default function EmptyState({ icon = 'inbox', title, children, action }: Props) {
  return (
    <div className="empty-state">
      <span className="icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
