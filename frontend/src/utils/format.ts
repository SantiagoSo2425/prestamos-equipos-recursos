const TZ = 'America/Bogota'

const dateTime = new Intl.DateTimeFormat('es-CO', {
  timeZone: TZ,
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Fecha y hora legibles en la zona horaria institucional (America/Bogota). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : dateTime.format(d)
}

/** Convierte un valor de `<input type="datetime-local">` (hora de Bogotá) a ISO con zona. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined
  return `${value.length === 16 ? value + ':00' : value}-05:00`
}

/** Valor actual en formato `datetime-local` para la hora de Bogotá. */
export function nowForInput(): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())
  return parts.replace(' ', 'T')
}
