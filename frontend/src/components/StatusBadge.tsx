import type { EffectiveStatus, ResourceStatus } from '../api/types'

const LABELS: Record<EffectiveStatus | ResourceStatus, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  ACTIVA: 'Activa',
  DEVUELTA: 'Devuelta',
  VENCIDA: 'Vencida',
  ACTIVO: 'Activo',
  EN_REVISION: 'En revisión',
  DADO_DE_BAJA: 'Dado de baja',
}

const TONES: Record<EffectiveStatus | ResourceStatus, string> = {
  PENDIENTE: 'badge-warn',
  APROBADA: 'badge-info',
  RECHAZADA: 'badge-bad',
  CANCELADA: 'badge-muted',
  ACTIVA: 'badge-ok',
  DEVUELTA: 'badge-muted',
  VENCIDA: 'badge-bad',
  ACTIVO: 'badge-ok',
  EN_REVISION: 'badge-warn',
  DADO_DE_BAJA: 'badge-muted',
}

export default function StatusBadge({ status }: { status: EffectiveStatus | ResourceStatus }) {
  return <span className={`badge ${TONES[status]}`}>{LABELS[status]}</span>
}
