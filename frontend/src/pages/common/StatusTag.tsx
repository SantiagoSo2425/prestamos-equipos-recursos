import { statusLabel } from './status'

const TONE: Record<string, string> = {
  ACTIVO: 'badge-ok',
  DEVUELTA: 'badge-muted',
  APROBADA: 'badge-info',
  ACTIVA: 'badge-ok',
  PENDIENTE: 'badge-warn',
  EN_REVISION: 'badge-warn',
  VENCIDA: 'badge-bad',
  RECHAZADA: 'badge-bad',
  CANCELADA: 'badge-muted',
  DADO_DE_BAJA: 'badge-muted',
}

export default function StatusTag({ status }: { status: string }) {
  return <span className={`badge ${TONE[status] ?? 'badge-muted'}`}>{statusLabel(status)}</span>
}
