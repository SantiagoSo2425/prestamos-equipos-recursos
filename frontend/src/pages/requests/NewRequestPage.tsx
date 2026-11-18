import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Loan, ResourceDetail } from '../../api/types'
import EmptyState from '../../components/EmptyState'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/toast-context'
import { formatDateTime, localInputToIso, toLocalInput } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import { fieldError } from '../common/errors'

const MIN_PURPOSE = 10
const MAX_PURPOSE = 500
const DURATIONS = [1, 2, 4, 8, 24]

export default function NewRequestPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
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
      toast.success('Solicitud enviada. Te avisaremos cuando sea evaluada.')
      navigate('/mis-solicitudes')
    },
  })

  /** Quita el error de un campo en cuanto el usuario lo corrige. */
  const clearError = (field: string) =>
    setErrors((e) => {
      if (!(field in e)) return e
      const { [field]: _removed, ...rest } = e
      return rest
    })

  function setDuration(hours: number) {
    if (!start) {
      setErrors((e) => ({ ...e, start_at: 'Primero indica la fecha y hora de inicio.' }))
      return
    }
    setEnd(toLocalInput(new Date(new Date(start).getTime() + hours * 3_600_000)))
    clearError('end_at')
  }

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
      <section>
        <PageHeader title="Nueva solicitud" />
        <EmptyState
          icon="catalog"
          title="Elige primero un recurso"
          action={
            <Link className="btn" to="/catalogo">
              Ir al catálogo
            </Link>
          }
        >
          Desde el catálogo puedes ver qué está disponible y pulsar «Solicitar».
        </EmptyState>
      </section>
    )
  }

  if (resource.isLoading)
    return (
      <section role="status" aria-label="Cargando">
        <Skeleton width="40%" height={30} />
        <div style={{ height: 24 }} />
        <Skeleton height={260} />
      </section>
    )

  if (resource.isError) {
    return (
      <section>
        <PageHeader title="Nueva solicitud" back={{ to: '/catalogo', label: 'Volver al catálogo' }} />
        <ApiErrorMessage error={resource.error} />
      </section>
    )
  }

  const r = resource.data!
  const shown = (field: string) => errors[field] ?? fieldError(create.error, field)
  const len = purpose.trim().length

  return (
    <section>
      <PageHeader
        back={{ to: '/catalogo', label: 'Catálogo' }}
        title="Nueva solicitud"
        subtitle="Indica cuándo necesitas el recurso y para qué lo usarás."
      />

      <div className="card">
        <div className="row">
          <div>
            <strong>{r.name}</strong>
            <div className="muted">
              {r.code} · {r.category.name} · máximo {r.category.max_loan_hours} h por préstamo
            </div>
          </div>
        </div>
        {r.busy_periods.length > 0 && (
          <details style={{ marginTop: '0.8rem' }}>
            <summary className="muted">Ver periodos ocupados ({r.busy_periods.length})</summary>
            <ul>
              {r.busy_periods.map((b) => (
                <li key={b.loan_id}>
                  {formatDateTime(b.start_at)} → {b.end_at ? formatDateTime(b.end_at) : 'hasta su devolución'}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <form className="card form" onSubmit={onSubmit} noValidate>
        <div className="filters" style={{ border: 'none', padding: 0, boxShadow: 'none', margin: 0, background: 'none' }}>
          <label>
            Inicio
            <input type="datetime-local" value={start} onChange={(e) => {
                setStart(e.target.value)
                clearError('start_at')
              }}
            />
            {shown('start_at') && <span className="field-error">{shown('start_at')}</span>}
          </label>
          <label>
            Fin
            <input type="datetime-local" value={end} onChange={(e) => {
                setEnd(e.target.value)
                clearError('end_at')
              }}
            />
            {shown('end_at') && <span className="field-error">{shown('end_at')}</span>}
          </label>
        </div>

        <div>
          <span className="muted" style={{ fontSize: '0.84rem' }}>
            Duración rápida:
          </span>
          <div className="chips" style={{ marginTop: '0.35rem' }}>
            {DURATIONS.filter((h) => h <= r.category.max_loan_hours).map((h) => (
              <button type="button" key={h} className="chip" onClick={() => setDuration(h)}>
                <Icon name="clock" size={13} /> {h} h
              </button>
            ))}
          </div>
        </div>

        <label>
          Propósito
          <textarea
            value={purpose}
            maxLength={MAX_PURPOSE + 50}
            placeholder="Ej.: Práctica de laboratorio de redes con el grupo 3"
            onChange={(e) => {
              setPurpose(e.target.value)
              clearError('purpose')
            }}
          />
          <span className="counter" style={{ color: len > MAX_PURPOSE ? 'var(--bad)' : undefined }}>
            {len}/{MAX_PURPOSE} · mínimo {MIN_PURPOSE} caracteres
          </span>
          {shown('purpose') && <span className="field-error">{shown('purpose')}</span>}
        </label>

        {create.isError && <ApiErrorMessage error={create.error} />}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <Link className="btn ghost" to="/catalogo">
            Cancelar
          </Link>
          <button type="submit" className="primary" disabled={create.isPending}>
            {create.isPending && <span className="spinner" />}
            {create.isPending ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </section>
  )
}
