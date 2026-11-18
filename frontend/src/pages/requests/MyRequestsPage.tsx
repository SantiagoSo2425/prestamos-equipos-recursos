import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Loan, Page } from '../../api/types'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import PageHeader from '../../components/PageHeader'
import { TableSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/toast-context'
import { formatDateTime } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import Pagination from '../common/Pagination'
import StatusTag from '../common/StatusTag'

const SIZE = 10

export default function MyRequestsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [cancelling, setCancelling] = useState<Loan | null>(null)

  const loans = useQuery({
    queryKey: ['loans', 'mine', page],
    queryFn: () => apiFetch<Page<Loan>>('/loans', { query: { page, size: SIZE } }),
    placeholderData: (prev) => prev,
  })

  const cancel = useMutation({
    mutationFn: (id: number) => apiFetch<Loan>(`/loans/${id}/cancel`, { method: 'POST', body: {} }),
    onSuccess: () => {
      setCancelling(null)
      toast.success('Solicitud cancelada.')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['loans'] })
      void queryClient.invalidateQueries({ queryKey: ['resources'] })
    },
  })

  const data = loans.data

  return (
    <section>
      <PageHeader
        title="Mis solicitudes"
        subtitle="Sigue el estado de cada solicitud, desde que la envías hasta que devuelves el equipo."
        actions={
          <Link className="btn" to="/catalogo">
            Nueva solicitud
          </Link>
        }
      />

      {loans.isLoading && <TableSkeleton />}
      {loans.isError && <ApiErrorMessage error={loans.error} />}

      {data && data.items.length === 0 && (
        <EmptyState
          icon="requests"
          title="Aún no tienes solicitudes"
          action={
            <Link className="btn" to="/catalogo">
              Explorar el catálogo
            </Link>
          }
        >
          Cuando pidas un recurso, aparecerá aquí con su estado y su historial.
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap" style={{ opacity: loans.isPlaceholderData ? 0.6 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Recurso</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.resource.name}</strong>
                      <div className="muted">{l.resource.code}</div>
                    </td>
                    <td>
                      {formatDateTime(l.start_at)}
                      <div className="muted">hasta {formatDateTime(l.end_at)}</div>
                    </td>
                    <td>
                      <StatusTag status={l.effective_status} />
                      {l.effective_status === 'VENCIDA' && (
                        <div className="field-error">{l.days_overdue} día(s) de retraso</div>
                      )}
                    </td>
                    <td>
                      {l.status === 'RECHAZADA' && l.rejection_reason && (
                        <div className="field-error">Motivo: {l.rejection_reason}</div>
                      )}
                      <Link to={`/prestamos/${l.id}`}>Ver detalle</Link>
                    </td>
                    <td>
                      {(l.status === 'PENDIENTE' || l.status === 'APROBADA') && (
                        <button className="danger sm" onClick={() => setCancelling(l)}>
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} size={data.size} total={data.total} onChange={setPage} />
        </>
      )}

      {cancelling && (
        <ConfirmDialog
          title="¿Cancelar esta solicitud?"
          message={`Se cancelará la solicitud de ${cancelling.resource.name} (${cancelling.resource.code}). Esta acción no se puede deshacer.`}
          confirmLabel="Sí, cancelar solicitud"
          busy={cancel.isPending}
          danger
          error={cancel.error}
          onConfirm={() => cancel.mutate(cancelling.id)}
          onCancel={() => setCancelling(null)}
        />
      )}
    </section>
  )
}
