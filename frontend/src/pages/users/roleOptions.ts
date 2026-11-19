import type { Role } from '../../api/types'

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'SOLICITANTE', label: 'Solicitante' },
  { value: 'RESPONSABLE', label: 'Responsable de préstamos' },
  { value: 'COORDINACION', label: 'Coordinación' },
]
