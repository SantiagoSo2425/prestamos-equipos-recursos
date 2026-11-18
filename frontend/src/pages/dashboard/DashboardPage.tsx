import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Loan } from '../../api/types'
import EmptyState from '../../components/EmptyState'
import PageHeader from '../../components/PageHeader'
import { Skeleton } from '../../components/Skeleton'
import { formatDateTime, toDateInput } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import { statusLabel } from '../common/status'
import StatusTag from '../common/StatusTag'

interface Summary {
  loans_by_status: Record<string, number>
  resources_by_status: Record<string, number>
  active_loans: Loan[]
  overdue_loans: Loan[]
}

interface Usage {
  by_category: { category: string; loans: number; hours: number }[]
  by_resource: {
    resource_id: number
    code: string
    name: string
    loans: number
    hours: number
    last_loan_at: string | null
  }[]
}

const LOAN_TONE: Record<string, string> = {
  PENDIENTE: 'warn',
  APROBADA: 'info',
  RECHAZADA: 'bad',
  CANCELADA: 'muted',
  ACTIVA: 'ok',
  VENCIDA: 'bad',
  DEVUELTA: 'muted',
}

const RESOURCE_TONE: Record<string, string> = {
  ACTIVO: 'ok',
  EN_REVISION: 'warn',
  DADO_DE_BAJA: 'muted',
}

function LoanRows({ loans }: { loans: Loan[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Recurso</th>
            <th>Solicitante</th>
            <th>Entregó</th>
            <th>Fin previsto</th>
            <th>Retraso</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id}>
              <td>
                <strong>{l.resource.name}</strong>
                <div className="muted">{l.resource.code}</div>
              </td>
              <td>{l.requester.full_name}</td>
              <td>{l.delivered_by?.full_name ?? '—'}</td>
              <td>{formatDateTime(l.end_at)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {l.days_overdue > 0 ? (
                  <>
                    <StatusTag status="VENCIDA" /> <span className="muted">{l.days_overdue} d</span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td>
                <Link to={`/prestamos/${l.id}`}>Ver</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UsageBars({ rows }: { rows: { key: string; label: string; hint: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="card">
      {rows.map((r) => (
        <div className="bar-row" key={r.key}>
          <span>
            <strong>{r.label}</strong>
          </span>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
          </div>
          <span className="muted">{r.hint}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 30 * 86_400_000)))
  const [to, setTo] = useState(() => toDateInput(new Date()))
  const [range, setRange] = useState({ from, to })
  const [rangeError, setRangeError] = useState<string | null>(null)

  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiFetch<Summary>('/dashboard/summary'),
  })

  const usage = useQuery({
    queryKey: ['dashboard', 'usage', range],
    queryFn: () =>
      apiFetch<Usage>('/dashboard/usage', {
        query: {
          from: new Date(`${range.from}T00:00:00`).toISOString(),
          // el día final se incluye completo
          to: new Date(`${range.to}T23:59:59`).toISOString(),
        },
      }),
  })

  function applyRange() {
    if (!from || !to || from > to) {
      setRangeError('Indica un rango válido: la fecha inicial no puede ser posterior a la final.')
      return
    }
    setRangeError(null)
    setRange({ from, to })
  }

  const s = summary.data

  return (
    <section>
      <PageHeader
        title="Tablero"
        subtitle="Una vista consolidada del estado de los préstamos y de los recursos."
      />
      {summary.isError && <ApiErrorMessage error={summary.error} />}

      {summary.isLoading && (
        <div className="stats" role="status" aria-label="Cargando">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} height={86} />
          ))}
        </div>
      )}

      {s && (
        <>
          <h2 style={{ marginTop: 0 }}>Préstamos por estado</h2>
          <div className="stats">
            {Object.entries(s.loans_by_status).map(([k, v]) => (
              <div className={`stat ${LOAN_TONE[k] ?? ''}`} key={k}>
                <span className="num">{v}</span>
                <span className="label">{statusLabel(k)}</span>
              </div>
            ))}
          </div>

          <h2>Recursos por estado</h2>
          <div className="stats">
            {Object.entries(s.resources_by_status).map(([k, v]) => (
              <div className={`stat ${RESOURCE_TONE[k] ?? ''}`} key={k}>
                <span className="num">{v}</span>
                <span className="label">{statusLabel(k)}</span>
              </div>
            ))}
          </div>

          <h2>Préstamos vencidos ({s.overdue_loans.length})</h2>
          {s.overdue_loans.length === 0 ? (
            <EmptyState icon="checkCircle" title="Todo al día">
              No hay préstamos vencidos sin devolver.
            </EmptyState>
          ) : (
            <LoanRows loans={s.overdue_loans} />
          )}

          <h2>Préstamos activos ({s.active_loans.length})</h2>
          {s.active_loans.length === 0 ? (
            <EmptyState icon="box" title="Sin préstamos activos">
              Los recursos entregados que estén en curso aparecerán aquí.
            </EmptyState>
          ) : (
            <LoanRows loans={s.active_loans} />
          )}
        </>
      )}

      <h2>Uso de recursos</h2>
      <div className="filters" style={{ maxWidth: 560 }}>
        <label>
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="filter-actions">
          <button className="primary" onClick={applyRange}>
            Aplicar
          </button>
        </div>
      </div>
      {rangeError && (
        <p role="alert" className="field-error">
          {rangeError}
        </p>
      )}
      {usage.isError && <ApiErrorMessage error={usage.error} />}
      {usage.data && (
        <>
          <h3>Horas de uso por categoría</h3>
          {usage.data.by_category.length === 0 ? (
            <EmptyState icon="clock" title="Sin uso en este rango">
              No hubo préstamos entregados entre las fechas seleccionadas.
            </EmptyState>
          ) : (
            <UsageBars
              rows={usage.data.by_category.map((c) => ({
                key: c.category,
                label: c.category,
                hint: `${c.hours} h · ${c.loans} préstamo(s)`,
                value: c.hours,
              }))}
            />
          )}
          {usage.data.by_resource.length > 0 && (
            <>
              <h3>Recursos más usados</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Recurso</th>
                      <th>Préstamos</th>
                      <th>Horas de uso</th>
                      <th>Último préstamo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.data.by_resource.map((r) => (
                      <tr key={r.resource_id}>
                        <td>
                          <strong>{r.name}</strong>
                          <div className="muted">{r.code}</div>
                        </td>
                        <td>{r.loans}</td>
                        <td>{r.hours}</td>
                        <td>{formatDateTime(r.last_loan_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
