import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { EffectiveStatus, Loan, Page, ResourceDetail } from '../../api/types'
import ConfirmDialog from '../../components/ConfirmDialog'
import DataTable, { type Column } from '../../components/DataTable'
import ErrorAlert from '../../components/ErrorAlert'
import PageHeader from '../../components/PageHeader'
import { TableSkeleton } from '../../components/Skeleton'
import StatusBadge from '../../components/StatusBadge'
import { useToast } from '../../components/toast-context'
import DeliverForm from '../loans/DeliverForm'
import ReturnForm from '../loans/ReturnForm'
import { formatDateTime } from '../../utils/format'

type Tab = 'PENDIENTE' | 'APROBADA' | 'ACTIVAS'

const TABS: { key: Tab; label: string; statuses: EffectiveStatus[] }[] = [
  { key: 'PENDIENTE', label: 'Pendientes', statuses: ['PENDIENTE'] },
  { key: 'APROBADA', label: 'Aprobadas por entregar', statuses: ['APROBADA'] },
  { key: 'ACTIVAS', label: 'Activas y vencidas', statuses: ['VENCIDA', 'ACTIVA'] },
]

/** Periodos APROBADA/ACTIVA del recurso que chocan con la solicitud (usa GET /resources/{id}). */
function Conflicts({ loan }: { loan: Loan }) {
  const q = useQuery({
    queryKey: ['resource', loan.resource.id],
    queryFn: () => apiFetch<ResourceDetail>(`/resources/${loan.resource.id}`),
  })
  if (!q.data) return null
  const start = new Date(loan.start_at).getTime()
  const end = new Date(loan.end_at).getTime()
  const clash = q.data.busy_periods.filter(
    (p) => p.loan_id !== loan.id && new Date(p.start_at).getTime() < end && (p.end_at === null || new Date(p.end_at).getTime() > start),
  )
  if (clash.length === 0) return <small>Sin conflictos con otras reservas.</small>
  return (
    <div className="alert alert-warn">
      Conflicto con:
      <ul className="conflicts">
        {clash.map((p) => (
          <li key={p.loan_id}>
            #{p.loan_id} ({p.status}) {formatDateTime(p.start_at)} →{' '}
            {p.end_at ? formatDateTime(p.end_at) : 'hasta su devolución'}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ReviewInboxPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('PENDIENTE')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<Loan | null>(null)
  const [delivering, setDelivering] = useState<Loan | null>(null)
  const [returning, setReturning] = useState<Loan | null>(null)

  const statuses = TABS.find((t) => t.key === tab)!.statuses
  const query = useQuery({
    queryKey: ['loans', 'inbox', tab, page],
    queryFn: async () => {
      const pages = await Promise.all(
        statuses.map((status) => apiFetch<Page<Loan>>('/loans', { query: { status, page, size: 20, sort: 'start_at' } })),
      )
      return { items: pages.flatMap((p) => p.items), total: pages.reduce((n, p) => n + p.total, 0) }
    },
  })

  const toast = useToast()
  const refresh = () => qc.invalidateQueries({ queryKey: ['loans'] })
  const approve = useMutation({
    mutationFn: (id: number) => apiFetch<Loan>(`/loans/${id}/approve`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Solicitud aprobada.')
      refresh()
    },
  })
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiFetch<Loan>(`/loans/${id}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      setRejecting(null)
      toast.success('Solicitud rechazada.')
      refresh()
    },
  })

  const columns: Column<Loan>[] = [
    { header: '#', render: (l) => <Link to={`/prestamos/${l.id}`}>{l.id}</Link> },
    { header: 'Solicitante', render: (l) => `${l.requester.full_name} (${l.requester.requester_type})` },
    { header: 'Recurso', render: (l) => `${l.resource.code} — ${l.resource.name}` },
    {
      header: 'Periodo',
      render: (l) => (
        <>
          {formatDateTime(l.start_at)} → {formatDateTime(l.end_at)}
        </>
      ),
    },
    {
      header: tab === 'PENDIENTE' ? 'Propósito y conflictos' : 'Estado',
      render: (l) =>
        tab === 'PENDIENTE' ? (
          <>
            <div>{l.purpose}</div>
            <Conflicts loan={l} />
          </>
        ) : (
          <>
            <StatusBadge status={l.effective_status} />
            {l.days_overdue > 0 && <div>{l.days_overdue} día(s) de retraso</div>}
          </>
        ),
    },
    {
      header: 'Acciones',
      render: (l) => (
        <div className="actions" style={{ margin: 0, justifyContent: 'flex-start' }}>
          {l.status === 'PENDIENTE' && (
            <>
              <button className="primary" disabled={approve.isPending} onClick={() => approve.mutate(l.id)}>
                Aprobar
              </button>
              <button className="danger" onClick={() => setRejecting(l)}>
                Rechazar
              </button>
            </>
          )}
          {l.status === 'APROBADA' && <button onClick={() => setDelivering(l)}>Entregar</button>}
          {l.status === 'ACTIVA' && <button onClick={() => setReturning(l)}>Devolver</button>}
        </div>
      ),
    },
  ]

  return (
    <section>
      <PageHeader
        title="Gestión de solicitudes"
        subtitle="Evalúa las solicitudes pendientes, entrega los equipos aprobados y registra las devoluciones."
      />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => {
              setTab(t.key)
              setPage(1)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorAlert error={approve.error} />
      {query.isLoading && <TableSkeleton />}
      <ErrorAlert error={query.error} />
      {query.data && (
        <DataTable
          columns={columns}
          rows={query.data.items}
          rowKey={(l) => l.id}
          page={page}
          size={20}
          total={Math.ceil(query.data.total / statuses.length)}
          onPageChange={setPage}
          empty="No hay operaciones en esta bandeja."
        />
      )}

      {rejecting && (
        <ConfirmDialog
          title={`Rechazar solicitud #${rejecting.id}`}
          message="El motivo es obligatorio y lo verá el solicitante."
          confirmLabel="Rechazar"
          danger
          textLabel="Motivo del rechazo"
          textRequired
          minLength={5}
          busy={reject.isPending}
          error={reject.error}
          onConfirm={(reason) => reject.mutate({ id: rejecting.id, reason })}
          onCancel={() => setRejecting(null)}
        />
      )}
      {delivering && (
        <div className="overlay">
          <div className="dialog">
            <DeliverForm
              loanId={delivering.id}
              onDone={() => {
                setDelivering(null)
                toast.success('Entrega registrada.')
              }}
              onCancel={() => setDelivering(null)}
            />
          </div>
        </div>
      )}
      {returning && (
        <div className="overlay">
          <div className="dialog">
            <ReturnForm
              loanId={returning.id}
              onDone={() => {
                setReturning(null)
                toast.success('Devolución registrada.')
              }}
              onCancel={() => setReturning(null)}
            />
          </div>
        </div>
      )}
    </section>
  )
}
