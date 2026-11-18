import type { Role } from '../api/types'

/** Página de inicio según el rol del usuario. */
export const HOME_BY_ROLE: Record<Role, string> = {
  SOLICITANTE: '/catalogo',
  RESPONSABLE: '/gestion',
  COORDINACION: '/tablero',
}
