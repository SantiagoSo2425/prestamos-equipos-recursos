import type { ApiErrorBody, FieldError, User } from './types'

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

const TOKEN_KEY = 'prestamos.token'
const USER_KEY = 'prestamos.user'

export class ApiError extends Error {
  status: number
  code: string
  detail: string
  fields: FieldError[]

  constructor(status: number, code: string, detail: string, fields: FieldError[] = []) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
    this.fields = fields
  }
}

// ---- Sesión (sessionStorage: se pierde al cerrar la pestaña) ----
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function saveSession(token: string, user: User): void {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  } catch {
    /* sin almacenamiento disponible */
  }
}

// ---- Cliente ----
type Query = Record<string, string | number | boolean | null | undefined>

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Query
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_URL.replace(/\/$/, '') + path)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  return url.toString()
}

export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.')
  }

  if (res.status === 204) return undefined as T

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* cuerpo vacío o no JSON */
  }

  if (!res.ok) {
    const body = (data ?? {}) as Partial<ApiErrorBody>
    const error = new ApiError(
      res.status,
      body.code ?? 'HTTP_ERROR',
      body.detail ?? 'Ocurrió un error inesperado.',
      body.fields ?? [],
    )
    // Sesión inválida o vencida: limpiar y volver al login (salvo en el propio login).
    if (res.status === 401 && path !== '/auth/login') {
      clearSession()
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    throw error
  }
  return data as T
}
