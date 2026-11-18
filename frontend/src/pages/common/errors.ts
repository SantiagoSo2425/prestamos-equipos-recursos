import { ApiError } from '../../api/client'

/** Mensaje de un campo concreto devuelto por el servidor (errores 422). */
export function fieldError(error: unknown, field: string): string | undefined {
  if (error instanceof ApiError) return error.fields.find((f) => f.field === field)?.message
  return undefined
}
