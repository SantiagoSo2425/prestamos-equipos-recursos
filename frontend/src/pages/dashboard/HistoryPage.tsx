import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Category, Loan, Page, Resource } from '../../api/types'
import { formatDateTime } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import Pagination from '../common/Pagination'
import { LOAN_STATUS_OPTIONS } from '../common/status'
import StatusTag from '../common/StatusTag'

interface Filters {
  status: string
  category_id: string
  resource_id: string
  requester_id: string
  from: string
  to: string
}

const EMPTY: Filters = {
  status: '',
  category_id: '',
  resource_id: '',
  requester_id: '',
  from: '',
  to: '',
}
const SIZE = 20

export default function HistoryPage() {
  const [form, setForm] = useState<Filters>(EMPTY)
  const [applied, setApplied] = useState<Filters>(EMPTY)
  const [page, setPage] = useState(1)
  const [formError, setFormError] = useState<string | null>(null)

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<Category[]>('/categories'),
  })
  const resources = useQuery({
    queryKey: ['resources', 'all'],
    queryFn: () => apiFetch<Page<Resource>>('/resources', { query: { size: 100 } }),
  })

  const loans = useQuery({
    queryKey: ['loans', 'history', applied, page],
    queryFn: () =>
      apiFetch<Page<Loan>>('/loans', {
        query: {
          status: applied.status,
          category_id: applied.category_id,
          resource_id: applied.resource_id,
          requester_id: applied.requester_id,
          from: applied.from ? new Date(`${applied.from}T00:00:00`).toISOString() : undefined,
          to: applied.to ? new Date(`${applied.to}T23:59:59`).toISOString() : undefined,
          page,
          size: SIZE,
        },
      }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!!form.from !== !!form.to) {
      setFormError('Indica la fecha inicial y la final del rango.')
      return
    }
    if (form.from && form.from > form.to) {
      setFormError('La fecha inicial no puede ser posterior a la final.')
      return
    }
    setFormError(null)
    setPage(1)
    setApplied(form)
  }

  const set = (k: keyof Filters) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value })

  const data = loans.data

  return (
    <main>
      <h1>Historial de préstamos</h1>
      <form className="filters" onSubmit={onSubmit} noValidate>
        <label>
          Estado
          <select value={form.status} onChange={set('status')}>
            <option value="">Todos</option>
            {LOAN_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <select value={form.category_id} onChange={set('category_id')}>
            <option value="">Todas</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recurso
          <select value={form.resource_id} onChange={set('resource_id')}>
            <option value="">Todos</option>
            {resources.data?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          ID solicitante
          <input
            type="number"
            min={1}
            value={form.requester_id}
            onChange={set('requester_id')}
            style={{ width: '7rem' }}
          />
        </label>
        <label>
          Desde
          <input type="date" value={form.from} onChange={set('from')} />
        </label>
        <label>
          Hasta
          <input type="date" value={form.to} onChange={set('to')} />
        </label>
        <button type="submit">Filtrar</button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setForm(EMPTY)
            setApplied(EMPTY)
            setPage(1)
            setFormError(null)
          }}
        >
          Limpiar
        </button>
      </form>
      {formError && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}

      {loans.isLoading && <p>Cargando…</p>}
      {loans.isError && <ApiErrorMessage error={loans.error} />}
      {data && data.items.length === 0 && (
        <p className="alert info">No hay operaciones con esos filtros.</p>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Recurso</th>
                  <th>Solicitante</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id}>
                    <td>{l.id}</td>
                    <td>
                      {l.resource.code} · {l.resource.name}
                    </td>
                    <td>
                      {l.requester.full_name}{' '}
                      <span className="muted">({l.requester.requester_type})</span>
                    </td>
                    <td>
                      {formatDateTime(l.start_at)}
                      <br />→ {formatDateTime(l.end_at)}
                    </td>
                    <td>
                      <StatusTag status={l.effective_status} />
                    </td>
                    <td>
                      <Link to={`/prestamos/${l.id}`}>Ver</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} size={data.size} total={data.total} onChange={setPage} />
        </>
      )}
    </main>
  )
}
