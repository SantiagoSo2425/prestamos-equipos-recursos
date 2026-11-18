import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Category, Page, Resource } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import EmptyState from '../../components/EmptyState'
import Icon, { type IconName } from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { CardGridSkeleton } from '../../components/Skeleton'
import StatusBadge from '../../components/StatusBadge'
import { localInputToIso } from '../../utils/datetime'
import ResourceModal from '../../components/ResourceModal'
import ApiErrorMessage from '../common/ApiErrorMessage'
import Pagination from '../common/Pagination'

interface Filters {
  category_id: string
  q: string
  from: string
  to: string
  available_only: boolean
}

const EMPTY: Filters = { category_id: '', q: '', from: '', to: '', available_only: false }
const SIZE = 12

const REASON: Record<string, string> = {
  PRESTADO: 'Prestado',
  RESERVADO: 'Reservado',
  NO_ACTIVO: 'No activo',
}

function categoryIcon(name: string): IconName {
  const n = name.toLowerCase()
  if (n.includes('port')) return 'laptop'
  if (n.includes('cámara') || n.includes('camara')) return 'camera'
  if (n.includes('instrum')) return 'gauge'
  return 'box'
}

export default function CatalogPage() {
  const { user, hasRole } = useAuth()
  const [form, setForm] = useState<Filters>(EMPTY)
  const [applied, setApplied] = useState<Filters>(EMPTY)
  const [page, setPage] = useState(1)
  const [formError, setFormError] = useState<string | null>(null)
  // undefined = cerrado · null = crear · Resource = editar
  const [modal, setModal] = useState<Resource | null | undefined>(undefined)

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<Category[]>('/categories'),
  })

  const resources = useQuery({
    queryKey: ['resources', applied, page],
    queryFn: () =>
      apiFetch<Page<Resource>>('/resources', {
        query: {
          category_id: applied.category_id,
          q: applied.q.trim(),
          from: applied.from ? localInputToIso(applied.from) : undefined,
          to: applied.to ? localInputToIso(applied.to) : undefined,
          available_only: applied.available_only || undefined,
          page,
          size: SIZE,
        },
      }),
    placeholderData: (prev) => prev,
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!!form.from !== !!form.to) {
      setFormError('Indica la fecha de inicio y la de fin del rango.')
      return
    }
    if (form.from && new Date(form.from) >= new Date(form.to)) {
      setFormError('La fecha de inicio debe ser anterior a la de fin.')
      return
    }
    if (form.available_only && !form.from) {
      setFormError('Para ver solo disponibles debes indicar un rango de fechas.')
      return
    }
    setFormError(null)
    setPage(1)
    setApplied(form)
  }

  function onClear() {
    setForm(EMPTY)
    setApplied(EMPTY)
    setPage(1)
    setFormError(null)
  }

  function canRequest(r: Resource): { ok: boolean; why?: string } {
    if (r.status !== 'ACTIVO') return { ok: false, why: 'El recurso no está activo' }
    if (r.available === false) return { ok: false, why: 'No disponible en el rango' }
    if (r.teacher_only && user?.requester_type !== 'DOCENTE')
      return { ok: false, why: 'Solo para docentes' }
    return { ok: true }
  }

  function requestLink(r: Resource): string {
    const p = new URLSearchParams({ recurso: String(r.id) })
    if (applied.from && applied.to) {
      p.set('from', applied.from)
      p.set('to', applied.to)
    }
    return `/solicitudes/nueva?${p.toString()}`
  }

  const data = resources.data

  return (
    <section>
      <PageHeader
        title="Catálogo de recursos"
        subtitle="Encuentra un equipo y comprueba si está libre en la fecha que lo necesitas."
        actions={
          hasRole('RESPONSABLE') && (
            <button className="primary" onClick={() => setModal(null)}>
              <Icon name="plus" size={17} /> Nuevo recurso
            </button>
          )
        }
      />

      <form className="filters" onSubmit={onSubmit} noValidate>
        <label>
          Buscar
          <input
            value={form.q}
            placeholder="Código o nombre"
            onChange={(e) => setForm({ ...form, q: e.target.value })}
          />
        </label>
        <label>
          Categoría
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            <option value="">Todas</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input
            type="datetime-local"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
        </label>
        <label>
          Hasta
          <input
            type="datetime-local"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={form.available_only}
            onChange={(e) => setForm({ ...form, available_only: e.target.checked })}
          />
          Solo disponibles
        </label>
        <div className="filter-actions">
          <button type="submit" className="primary">
            <Icon name="search" size={16} /> Buscar
          </button>
          <button type="button" className="ghost" onClick={onClear}>
            Limpiar
          </button>
        </div>
      </form>
      {formError && (
        <p role="alert" className="field-error" style={{ marginTop: '-0.8rem' }}>
          {formError}
        </p>
      )}

      {!applied.from && (
        <p className="muted" style={{ marginTop: '-0.4rem', fontSize: '0.88rem' }}>
          Tip: elige un rango de fechas para ver qué recursos están disponibles en ese momento.
        </p>
      )}

      {resources.isLoading && <CardGridSkeleton />}
      {resources.isError && <ApiErrorMessage error={resources.error} />}

      {data && data.items.length === 0 && (
        <EmptyState
          icon="search"
          title="No encontramos recursos"
          action={
            <button className="secondary" onClick={onClear}>
              Quitar filtros
            </button>
          }
        >
          Prueba con otra categoría, otro rango de fechas o una búsqueda más amplia.
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="resource-grid" style={{ opacity: resources.isPlaceholderData ? 0.6 : 1 }}>
            {data.items.map((r) => {
              const req = canRequest(r)
              return (
                <article className="resource-card" key={r.id}>
                  <div className="top">
                    <span className="resource-icon">
                      <Icon name={categoryIcon(r.category.name)} size={22} />
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div>
                    <span className="code">{r.code}</span>
                    <h3>
                      <Link to={`/catalogo/${r.id}`}>{r.name}</Link>
                    </h3>
                  </div>
                  <div className="meta">
                    <span>{r.category.name}</span>
                    {r.teacher_only && <span className="badge badge-info">Solo docentes</span>}
                    {r.available === true && <span className="badge badge-ok">Disponible</span>}
                    {r.available === false && (
                      <span className="badge badge-bad">
                        {REASON[r.unavailable_reason ?? ''] ?? 'No disponible'}
                      </span>
                    )}
                  </div>
                  <div className="foot">
                    {hasRole('SOLICITANTE') &&
                      (req.ok ? (
                        <Link className="btn sm" to={requestLink(r)}>
                          Solicitar
                        </Link>
                      ) : (
                        <button className="sm" disabled title={req.why}>
                          Solicitar
                        </button>
                      ))}
                    {hasRole('RESPONSABLE') && (
                      <button className="secondary sm" onClick={() => setModal(r)}>
                        <Icon name="edit" size={14} /> Editar
                      </button>
                    )}
                    <Link className="btn ghost sm" to={`/catalogo/${r.id}`}>
                      Ver detalle
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
          <Pagination page={data.page} size={data.size} total={data.total} onChange={setPage} />
        </>
      )}
      {modal !== undefined && (
        <ResourceModal resource={modal ?? undefined} onClose={() => setModal(undefined)} />
      )}
    </section>
  )
}
