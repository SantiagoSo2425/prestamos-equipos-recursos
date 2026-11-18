import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError, apiFetch } from '../../api/client'
import type { ResourceDetail } from '../../api/types'
import { formatDateTime } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import StatusTag from '../common/StatusTag'

export default function ResourceDetailPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: ['resource', id],
    queryFn: () => apiFetch<ResourceDetail>(`/resources/${id}`),
    retry: false,
  })

  if (query.isLoading) return <main>Cargando…</main>

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <main>
        <h1>Recurso</h1>
        {notFound ? (
          <p role="alert" className="alert error">
            El recurso solicitado no existe.
          </p>
        ) : (
          <ApiErrorMessage error={query.error} />
        )}
        <Link to="/catalogo">Volver al catálogo</Link>
      </main>
    )
  }

  const r = query.data!
  return (
    <main>
      <p>
        <Link to="/catalogo">← Catálogo</Link>
      </p>
      <h1>
        {r.code} · {r.name}
      </h1>
      <p>
        <StatusTag status={r.status} /> {r.teacher_only && <span className="tag">Solo docentes</span>}
      </p>
      <dl>
        <dt>Categoría</dt>
        <dd>
          {r.category.name} (máximo {r.category.max_loan_hours} h por préstamo)
        </dd>
        <dt>Descripción</dt>
        <dd>{r.description ?? 'Sin descripción.'}</dd>
      </dl>

      <h2>Periodos ocupados</h2>
      {r.busy_periods.length === 0 ? (
        <p className="muted">Sin reservas ni préstamos en curso.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {r.busy_periods.map((b) => (
                <tr key={b.loan_id}>
                  <td>{formatDateTime(b.start_at)}</td>
                  <td>{b.end_at ? formatDateTime(b.end_at) : 'Hasta su devolución'}</td>
                  <td>
                    <StatusTag status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
