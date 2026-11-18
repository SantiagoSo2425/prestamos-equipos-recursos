import { statusLabel } from './status'

const CLASS: Record<string, string> = {
  ACTIVO: 'ok',
  DEVUELTA: 'ok',
  APROBADA: 'info',
  ACTIVA: 'info',
  PENDIENTE: 'warn',
  EN_REVISION: 'warn',
  VENCIDA: 'bad',
  RECHAZADA: 'bad',
  CANCELADA: '',
  DADO_DE_BAJA: 'bad',
}

export default function StatusTag({ status }: { status: string }) {
  return <span className={`tag ${CLASS[status] ?? ''}`}>{statusLabel(status)}</span>
}
