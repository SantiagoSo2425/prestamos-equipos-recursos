import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Loan } from '../../api/types'
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
                {l.resource.code} · {l.resource.name}
              </td>
              <td>{l.requester.full_name}</td>
              <td>{l.delivered_by?.full_name ?? '—'}</td>
              <td>{formatDateTime(l.end_at)}</td>
              <td>
                {l.days_overdue > 0 ? <StatusTag status="VENCIDA" /> : '—'}
                {l.days_overdue > 0 && ` ${l.days_overdue} día(s)`}
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
    <main>
      <h1>Tablero de coordinación</h1>
      {summary.isLoading && <p>Cargando…</p>}
      {summary.isError && <ApiErrorMessage error={summary.error} />}

      {s && (
        <>
          <h2>Préstamos por estado</h2>
          <div className="cards">
            {Object.entries(s.loans_by_status).map(([k, v]) => (
              <div className="card" key={k}>
                <div className="num">{v}</div>
                <StatusTag status={k} />
              </div>
            ))}
          </div>

          <h2>Recursos por estado</h2>
          <div className="cards">
            {Object.entries(s.resources_by_status).map(([k, v]) => (
              <div className="card" key={k}>
                <div className="num">{v}</div>
                <span>{statusLabel(k)}</span>
              </div>
            ))}
          </div>

          <h2>Préstamos vencidos ({s.overdue_loans.length})</h2>
          {s.overdue_loans.length === 0 ? (
            <p className="muted">No hay préstamos vencidos.</p>
          ) : (
            <LoanRows loans={s.overdue_loans} />
          )}

          <h2>Préstamos activos ({s.active_loans.length})</h2>
          {s.active_loans.length === 0 ? (
            <p className="muted">No hay préstamos activos.</p>
          ) : (
            <LoanRows loans={s.active_loans} />
          )}
        </>
      )}

      <h2>Uso de recursos</h2>
      <div className="filters">
        <label>
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={applyRange}>Aplicar</button>
      </div>
      {rangeError && (
        <p role="alert" className="field-error">
          {rangeError}
        </p>
      )}
      {usage.isError && <ApiErrorMessage error={usage.error} />}
      {usage.data && (
        <>
          <h3>Por categoría</h3>
          {usage.data.by_category.length === 0 ? (
            <p className="muted">Sin préstamos entregados en el rango.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Préstamos</th>
                    <th>Horas de uso</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.data.by_category.map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td>{c.loans}</td>
                      <td>{c.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3>Por recurso</h3>
          {usage.data.by_resource.length > 0 && (
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
                        {r.code} · {r.name}
                      </td>
                      <td>{r.loans}</td>
                      <td>{r.hours}</td>
                      <td>{formatDateTime(r.last_loan_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  )
}
