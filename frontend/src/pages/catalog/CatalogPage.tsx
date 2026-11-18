import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Category, Page, Resource } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { localInputToIso } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import Pagination from '../common/Pagination'
import StatusTag from '../common/StatusTag'

interface Filters {
  category_id: string
  q: string
  from: string
  to: string
  available_only: boolean
}

const EMPTY: Filters = { category_id: '', q: '', from: '', to: '', available_only: false }
const SIZE = 20

const REASON: Record<string, string> = {
  PRESTADO: 'Prestado',
  RESERVADO: 'Reservado',
  NO_ACTIVO: 'No activo',
}

export default function CatalogPage() {
  const { user, hasRole } = useAuth()
  const [form, setForm] = useState<Filters>(EMPTY)
  const [applied, setApplied] = useState<Filters>(EMPTY)
  const [page, setPage] = useState(1)
  const [formError, setFormError] = useState<string | null>(null)

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
    <main>
      <h1>Catálogo de recursos</h1>

      <form className="filters" onSubmit={onSubmit} noValidate>
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
          Código o nombre
          <input value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
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
        <button type="submit">Buscar</button>
        <button type="button" className="secondary" onClick={onClear}>
          Limpiar
        </button>
        {hasRole('RESPONSABLE') && (
          <Link className="btn secondary" to="/recursos/nuevo">
            Nuevo recurso
          </Link>
        )}
      </form>
      {formError && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}

      {resources.isLoading && <p>Cargando recursos…</p>}
      {resources.isError && <ApiErrorMessage error={resources.error} />}
      {data && data.items.length === 0 && (
        <p className="alert info">No se encontraron recursos con esos filtros.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Disponibilidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => {
                  const req = canRequest(r)
                  return (
                    <tr key={r.id}>
                      <td>{r.code}</td>
                      <td>
                        <Link to={`/catalogo/${r.id}`}>{r.name}</Link>
                        {r.teacher_only && <span className="muted"> · solo docentes</span>}
                      </td>
                      <td>{r.category.name}</td>
                      <td>
                        <StatusTag status={r.status} />
                      </td>
                      <td>
                        {r.available === null ? (
                          <span className="muted">Indica un rango</span>
                        ) : r.available ? (
                          <span className="tag ok">Disponible</span>
                        ) : (
                          <span className="tag bad">
                            {REASON[r.unavailable_reason ?? ''] ?? 'No disponible'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          {hasRole('SOLICITANTE') &&
                            (req.ok ? (
                              <Link className="btn" to={requestLink(r)}>
                                Solicitar
                              </Link>
                            ) : (
                              <button disabled title={req.why}>
                                Solicitar
                              </button>
                            ))}
                          {hasRole('RESPONSABLE') && (
                            <Link className="btn secondary" to={`/recursos/${r.id}/editar`}>
                              Editar
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} size={data.size} total={data.total} onChange={setPage} />
        </>
      )}
    </main>
  )
}
