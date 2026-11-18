const TZ = 'America/Bogota'

const fmt = new Intl.DateTimeFormat('es-CO', {
  timeZone: TZ,
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Fecha y hora legibles en la zona horaria institucional (America/Bogota). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : fmt.format(d)
}

/** Convierte el valor de un `<input type="datetime-local">` a ISO 8601 con zona (UTC). */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}

/** Valor para `<input type="datetime-local">` a partir de un `Date` (hora local del navegador). */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Valor para `<input type="date">` a partir de un `Date`. */
export function toDateInput(d: Date): string {
  return toLocalInput(d).slice(0, 10)
}
