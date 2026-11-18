import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Loan, Page } from '../../api/types'
import { formatDateTime } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import Pagination from '../common/Pagination'
import StatusTag from '../common/StatusTag'

const SIZE = 10

export default function MyRequestsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const loans = useQuery({
    queryKey: ['loans', 'mine', page],
    queryFn: () => apiFetch<Page<Loan>>('/loans', { query: { page, size: SIZE } }),
  })

  const cancel = useMutation({
    mutationFn: (id: number) => apiFetch<Loan>(`/loans/${id}/cancel`, { method: 'POST', body: {} }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['loans'] })
      void queryClient.invalidateQueries({ queryKey: ['resources'] })
    },
  })

  function onCancel(l: Loan) {
    if (window.confirm(`¿Cancelar la solicitud de ${l.resource.code} · ${l.resource.name}?`)) {
      cancel.mutate(l.id)
    }
  }

  const data = loans.data

  return (
    <main>
      <h1>Mis solicitudes</h1>
      {loans.isLoading && <p>Cargando…</p>}
      {loans.isError && <ApiErrorMessage error={loans.error} />}
      {cancel.isError && <ApiErrorMessage error={cancel.error} />}

      {data && data.items.length === 0 && (
        <p className="alert info">
          Aún no tienes solicitudes. Busca un recurso en el <Link to="/catalogo">catálogo</Link>.
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
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
                      {l.resource.code} · {l.resource.name}
                    </td>
                    <td>
                      {formatDateTime(l.start_at)}
                      <br />→ {formatDateTime(l.end_at)}
                    </td>
                    <td>
                      <StatusTag status={l.effective_status} />
                      {l.effective_status === 'VENCIDA' && (
                        <div className="muted">{l.days_overdue} día(s) de retraso</div>
                      )}
                    </td>
                    <td>
                      {l.status === 'RECHAZADA' && l.rejection_reason && (
                        <span className="field-error">Motivo del rechazo: {l.rejection_reason}</span>
                      )}
                      <div>
                        <Link to={`/prestamos/${l.id}`}>Ver detalle</Link>
                      </div>
                    </td>
                    <td>
                      {(l.status === 'PENDIENTE' || l.status === 'APROBADA') && (
                        <button
                          className="danger"
                          disabled={cancel.isPending}
                          onClick={() => onCancel(l)}
                        >
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
    </main>
  )
}
