import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch } from '../../api/client'
import type { Loan } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorAlert from '../../components/ErrorAlert'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import { useToast } from '../../components/toast-context'
import { formatDateTime } from '../../utils/format'
import DeliverForm from './DeliverForm'
import MovementTimeline from './MovementTimeline'
import ReturnForm from './ReturnForm'

type Mode = null | 'reject' | 'deliver' | 'return'

export default function LoanDetailPage() {
  const { id } = useParams()
  const loanId = Number(id)
  const { hasRole } = useAuth()
  const isManager = hasRole('RESPONSABLE')
  const qc = useQueryClient()
  const toast = useToast()
  const [mode, setMode] = useState<Mode>(null)

  const query = useQuery({
    queryKey: ['loan', loanId],
    queryFn: () => apiFetch<Loan>(`/loans/${loanId}`),
    enabled: Number.isInteger(loanId),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['loan', loanId] })
    qc.invalidateQueries({ queryKey: ['loans'] })
  }

  const approve = useMutation({
    mutationFn: () => apiFetch<Loan>(`/loans/${loanId}/approve`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Solicitud aprobada.')
      refresh()
    },
  })
  const reject = useMutation({
    mutationFn: (reason: string) =>
      apiFetch<Loan>(`/loans/${loanId}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      setMode(null)
      toast.success('Solicitud rechazada.')
      refresh()
    },
  })

  if (query.isLoading) return <p>Cargando…</p>
  if (query.error) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <section>
        <h1>Operación no encontrada</h1>
        {notFound ? <p>La operación solicitada no existe o no tienes acceso a ella.</p> : <ErrorAlert error={query.error} />}
        <Link to="/">Volver</Link>
      </section>
    )
  }
  const loan = query.data!
  const done = () => {
    setMode(null)
    toast.success('Operación registrada.')
    refresh()
  }

  return (
    <section>
      <PageHeader
        back={{ to: '/', label: 'Volver' }}
        title={`Operación #${loan.id}`}
        subtitle={`${loan.resource.name} · ${loan.requester.full_name}`}
        actions={<StatusBadge status={loan.effective_status} />}
      />

      {loan.effective_status === 'VENCIDA' && (
        <div className="alert alert-error" role="alert">
          Préstamo vencido: lleva <strong>{loan.days_overdue}</strong> día(s) de retraso.
        </div>
      )}

      <div className="card">
        <dl className="detail-grid">
          <dt>Recurso</dt>
          <dd>
            {loan.resource.code} — {loan.resource.name} ({loan.resource.category})
          </dd>
          <dt>Solicitante</dt>
          <dd>
            {loan.requester.full_name} ({loan.requester.requester_type})
          </dd>
          <dt>Periodo solicitado</dt>
          <dd>
            {formatDateTime(loan.start_at)} → {formatDateTime(loan.end_at)}
          </dd>
          <dt>Propósito</dt>
          <dd>{loan.purpose}</dd>
          {loan.rejection_reason && (
            <>
              <dt>Motivo del rechazo</dt>
              <dd>{loan.rejection_reason}</dd>
            </>
          )}
          <dt>Aprobó</dt>
          <dd>
            {loan.approved_by ? `${loan.approved_by.full_name} · ${formatDateTime(loan.approved_at)}` : '—'}
          </dd>
          <dt>Entregó</dt>
          <dd>
            {loan.delivered_by ? `${loan.delivered_by.full_name} · ${formatDateTime(loan.delivered_at)}` : '—'}
          </dd>
          <dt>Condición de salida</dt>
          <dd>{loan.checkout_condition ?? '—'}</dd>
          <dt>Recibió</dt>
          <dd>
            {loan.received_by ? `${loan.received_by.full_name} · ${formatDateTime(loan.returned_at)}` : '—'}
          </dd>
          <dt>Condición de devolución</dt>
          <dd>
            {loan.return_condition
              ? `${loan.return_condition === 'BUENO' ? 'Bueno' : 'Con daño'}${loan.is_late ? ' · devuelto con retraso' : ''}`
              : '—'}
          </dd>
          {loan.return_notes && (
            <>
              <dt>Observaciones</dt>
              <dd>{loan.return_notes}</dd>
            </>
          )}
        </dl>
      </div>

      <h2>Historial</h2>
      <MovementTimeline loanId={loan.id} />

      {isManager && (
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          {loan.status === 'PENDIENTE' && (
            <button className="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
              {approve.isPending ? 'Aprobando…' : 'Aprobar'}
            </button>
          )}
          {(loan.status === 'PENDIENTE' || loan.status === 'APROBADA') && (
            <button className="danger" onClick={() => setMode('reject')}>
              Rechazar
            </button>
          )}
          {loan.status === 'APROBADA' && <button onClick={() => setMode('deliver')}>Entregar</button>}
          {loan.status === 'ACTIVA' && <button onClick={() => setMode('return')}>Devolver</button>}
        </div>
      )}
      <ErrorAlert error={approve.error} />

      {mode === 'deliver' && <DeliverForm loanId={loan.id} onDone={done} onCancel={() => setMode(null)} />}
      {mode === 'return' && <ReturnForm loanId={loan.id} onDone={done} onCancel={() => setMode(null)} />}
      {mode === 'reject' && (
        <ConfirmDialog
          title="Rechazar solicitud"
          message="Indica el motivo; el solicitante podrá verlo."
          confirmLabel="Rechazar"
          textLabel="Motivo del rechazo"
          textRequired
          minLength={5}
          busy={reject.isPending}
          error={reject.error}
          onConfirm={(reason) => reject.mutate(reason)}
          onCancel={() => setMode(null)}
        />
      )}
    </section>
  )
}
