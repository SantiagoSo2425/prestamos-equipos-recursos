import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Movement } from '../../api/types'
import { formatDateTime } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import { statusLabel } from '../common/status'

/** Historial de movimientos de un préstamo (creación → aprobación → entrega → devolución). */
export default function MovementTimeline({ loanId }: { loanId: number }) {
  const q = useQuery({
    queryKey: ['loan-movements', loanId],
    queryFn: () => apiFetch<Movement[]>(`/loans/${loanId}/movements`),
  })

  if (q.isLoading) return <p>Cargando historial…</p>
  if (q.isError) return <ApiErrorMessage error={q.error} />
  if (!q.data || q.data.length === 0) return <p className="muted">Sin movimientos registrados.</p>

  return (
    <ol className="timeline" aria-label="Historial de movimientos">
      {q.data.map((m) => (
        <li key={m.id}>
          <strong>
            {m.from_status ? `${statusLabel(m.from_status)} → ` : 'Creada → '}
            {statusLabel(m.to_status)}
          </strong>
          <div className="muted">
            {m.actor.full_name} · {formatDateTime(m.created_at)}
          </div>
          {m.note && <div>{m.note}</div>}
        </li>
      ))}
    </ol>
  )
}
