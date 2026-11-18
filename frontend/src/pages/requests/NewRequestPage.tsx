import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Loan, ResourceDetail } from '../../api/types'
import { formatDateTime, localInputToIso } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import { fieldError } from '../common/errors'

const MIN_PURPOSE = 10
const MAX_PURPOSE = 500

export default function NewRequestPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const resourceId = params.get('recurso')

  const [start, setStart] = useState(params.get('from') ?? '')
  const [end, setEnd] = useState(params.get('to') ?? '')
  const [purpose, setPurpose] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resource = useQuery({
    queryKey: ['resource', resourceId],
    queryFn: () => apiFetch<ResourceDetail>(`/resources/${resourceId}`),
    enabled: !!resourceId,
    retry: false,
  })

  const create = useMutation({
    mutationFn: (body: { resource_id: number; start_at: string; end_at: string; purpose: string }) =>
      apiFetch<Loan>('/loans', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loans'] })
      void queryClient.invalidateQueries({ queryKey: ['resources'] })
      navigate('/mis-solicitudes')
    },
  })

  function validate(maxHours: number | undefined): Record<string, string> {
    const e: Record<string, string> = {}
    const s = start ? new Date(start) : null
    const f = end ? new Date(end) : null
    if (!s) e.start_at = 'Indica la fecha y hora de inicio.'
    else if (s.getTime() < Date.now()) e.start_at = 'El inicio no puede estar en el pasado.'
    if (!f) e.end_at = 'Indica la fecha y hora de fin.'
    else if (s && f <= s) e.end_at = 'El fin debe ser posterior al inicio.'
    else if (s && f && maxHours && (f.getTime() - s.getTime()) / 3_600_000 > maxHours)
      e.end_at = `La duración máxima para esta categoría es de ${maxHours} horas.`
    const len = purpose.trim().length
    if (len < MIN_PURPOSE) e.purpose = `El propósito debe tener al menos ${MIN_PURPOSE} caracteres.`
    else if (len > MAX_PURPOSE) e.purpose = `El propósito no puede superar ${MAX_PURPOSE} caracteres.`
    return e
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!resource.data) return
    const e = validate(resource.data.category.max_loan_hours)
    setErrors(e)
    if (Object.keys(e).length > 0) return
    create.mutate({
      resource_id: resource.data.id,
      start_at: localInputToIso(start),
      end_at: localInputToIso(end),
      purpose: purpose.trim(),
    })
  }

  if (!resourceId) {
    return (
      <main>
        <h1>Nueva solicitud</h1>
        <p className="alert info">
          Elige primero un recurso en el <Link to="/catalogo">catálogo</Link>.
        </p>
      </main>
    )
  }
  if (resource.isLoading) return <main>Cargando recurso…</main>
  if (resource.isError) {
    return (
      <main>
        <h1>Nueva solicitud</h1>
        <ApiErrorMessage error={resource.error} />
        <Link to="/catalogo">Volver al catálogo</Link>
      </main>
    )
  }

  const r = resource.data!
  const shown = (field: string) => errors[field] ?? fieldError(create.error, field)

  return (
    <main>
      <h1>Nueva solicitud</h1>
      <p>
        <strong>
          {r.code} · {r.name}
        </strong>{' '}
        <span className="muted">
          ({r.category.name}, máximo {r.category.max_loan_hours} h)
        </span>
      </p>
      {r.busy_periods.length > 0 && (
        <details>
          <summary>Periodos ocupados ({r.busy_periods.length})</summary>
          <ul>
            {r.busy_periods.map((b) => (
              <li key={b.loan_id}>
                {formatDateTime(b.start_at)} → {b.end_at ? formatDateTime(b.end_at) : 'hasta su devolución'}
              </li>
            ))}
          </ul>
        </details>
      )}

      <form className="form" onSubmit={onSubmit} noValidate>
        <label>
          Inicio
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          {shown('start_at') && <span className="field-error">{shown('start_at')}</span>}
        </label>
        <label>
          Fin
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          {shown('end_at') && <span className="field-error">{shown('end_at')}</span>}
        </label>
        <label>
          Propósito
          <textarea
            value={purpose}
            maxLength={MAX_PURPOSE + 50}
            onChange={(e) => setPurpose(e.target.value)}
          />
          <span className="counter">
            {purpose.trim().length}/{MAX_PURPOSE} (mínimo {MIN_PURPOSE})
          </span>
          {shown('purpose') && <span className="field-error">{shown('purpose')}</span>}
        </label>

        {create.isError && <ApiErrorMessage error={create.error} />}

        <div className="actions">
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Enviando…' : 'Enviar solicitud'}
          </button>
          <Link className="btn secondary" to="/catalogo">
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  )
}
