import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError, apiFetch } from '../../api/client'
import type { ResourceDetail } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import EmptyState from '../../components/EmptyState'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import ResourceModal from '../../components/ResourceModal'
import { Skeleton } from '../../components/Skeleton'
import { formatDateTime } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import StatusTag from '../common/StatusTag'

export default function ResourceDetailPage() {
  const { id } = useParams()
  const { user, hasRole } = useAuth()
  const [editing, setEditing] = useState(false)
  const query = useQuery({
    queryKey: ['resource', id],
    queryFn: () => apiFetch<ResourceDetail>(`/resources/${id}`),
    retry: false,
  })

  if (query.isLoading)
    return (
      <section role="status" aria-label="Cargando">
        <Skeleton width={160} height={14} />
        <div style={{ height: 14 }} />
        <Skeleton width="50%" height={30} />
        <div style={{ height: 24 }} />
        <Skeleton height={160} />
      </section>
    )

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <section>
        <PageHeader title="Recurso" back={{ to: '/catalogo', label: 'Volver al catálogo' }} />
        {notFound ? (
          <EmptyState icon="search" title="Este recurso no existe">
            Puede que haya sido dado de baja o que el enlace sea incorrecto.
          </EmptyState>
        ) : (
          <ApiErrorMessage error={query.error} />
        )}
      </section>
    )
  }

  const r = query.data!
  const canRequest =
    hasRole('SOLICITANTE') &&
    r.status === 'ACTIVO' &&
    (!r.teacher_only || user?.requester_type === 'DOCENTE')

  return (
    <section>
      <PageHeader
        back={{ to: '/catalogo', label: 'Catálogo' }}
        title={r.name}
        subtitle={`${r.code} · ${r.category.name}`}
        actions={
          <>
            {canRequest && (
              <Link className="btn" to={`/solicitudes/nueva?recurso=${r.id}`}>
                Solicitar este recurso
              </Link>
            )}
            {hasRole('RESPONSABLE') && (
              <button className="secondary" onClick={() => setEditing(true)}>
                <Icon name="edit" size={16} /> Editar
              </button>
            )}
          </>
        }
      />

      <div className="card">
        <dl className="detail-grid">
          <dt>Estado</dt>
          <dd>
            <StatusTag status={r.status} />{' '}
            {r.teacher_only && <span className="badge badge-info">Solo docentes</span>}
          </dd>
          <dt>Duración máxima</dt>
          <dd>{r.category.max_loan_hours} horas por préstamo</dd>
          <dt>Descripción</dt>
          <dd>{r.description ?? 'Sin descripción.'}</dd>
        </dl>
      </div>

      <h2>Periodos ocupados</h2>
      {r.busy_periods.length === 0 ? (
        <EmptyState icon="calendar" title="Totalmente libre">
          No hay reservas ni préstamos en curso para este recurso.
        </EmptyState>
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
      {editing && <ResourceModal resource={r} onClose={() => setEditing(false)} />}
    </section>
  )
}
