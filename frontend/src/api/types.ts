// Tipos del contrato REST (specs/001-prestamos-equipos/contracts/api.md).
// Cambios solo junto con una actualización de contracts/api.md.

export type Role = 'SOLICITANTE' | 'RESPONSABLE' | 'COORDINACION'
export type RequesterType = 'ESTUDIANTE' | 'DOCENTE'
export type ResourceStatus = 'ACTIVO' | 'EN_REVISION' | 'DADO_DE_BAJA'
export type LoanStatus =
  | 'PENDIENTE'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'CANCELADA'
  | 'ACTIVA'
  | 'DEVUELTA'
export type EffectiveStatus = LoanStatus | 'VENCIDA'
export type Condition = 'BUENO' | 'CON_DANO'

export interface UserRef {
  id: number
  username: string
  full_name: string
}

export interface User extends UserRef {
  role: Role
  requester_type: RequesterType | null
  institutional_id: string
}

export interface UserAdmin extends User {
  is_active: boolean
  created_at: string
}

export interface Category {
  id: number
  name: string
  max_loan_hours: number
}

export interface Resource {
  id: number
  code: string
  name: string
  description: string | null
  category: Category
  status: ResourceStatus
  teacher_only: boolean
  /** null si no se envió rango from/to */
  available: boolean | null
  unavailable_reason: 'PRESTADO' | 'RESERVADO' | 'NO_ACTIVO' | null
}

export interface BusyPeriod {
  loan_id: number
  start_at: string
  /** null = préstamo vencido sin devolver (ocupación abierta) */
  end_at: string | null
  status: LoanStatus
}

export interface ResourceDetail extends Resource {
  busy_periods: BusyPeriod[]
}

export interface Loan {
  id: number
  resource: { id: number; code: string; name: string; category: string }
  requester: UserRef & { requester_type: RequesterType }
  start_at: string
  end_at: string
  purpose: string
  status: LoanStatus
  effective_status: EffectiveStatus
  rejection_reason: string | null
  approved_by: UserRef | null
  approved_at: string | null
  delivered_by: UserRef | null
  delivered_at: string | null
  checkout_condition: string | null
  received_by: UserRef | null
  returned_at: string | null
  return_condition: Condition | null
  return_notes: string | null
  is_late: boolean
  /** 0 si no está vencido */
  days_overdue: number
  created_at: string
  updated_at: string
}

export interface Movement {
  id: number
  actor: UserRef
  from_status: LoanStatus | null
  to_status: LoanStatus
  note: string | null
  created_at: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface TokenOut {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
}

export interface FieldError {
  field: string
  message: string
}

export interface ApiErrorBody {
  detail: string
  code: string
  fields?: FieldError[]
}
