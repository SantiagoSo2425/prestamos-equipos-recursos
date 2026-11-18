const LABEL: Record<string, string> = {
  EN_REVISION: 'En revisión',
  DADO_DE_BAJA: 'Dado de baja',
}

export function statusLabel(status: string): string {
  return LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase()
}

export const LOAN_STATUS_OPTIONS = [
  'PENDIENTE',
  'APROBADA',
  'RECHAZADA',
  'CANCELADA',
  'ACTIVA',
  'VENCIDA',
  'DEVUELTA',
] as const
