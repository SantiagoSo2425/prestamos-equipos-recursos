import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Page, UserAdmin } from '../../api/types'
import EmptyState from '../../components/EmptyState'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { TableSkeleton } from '../../components/Skeleton'
import UserModal from '../../components/UserModal'
import { formatDateTime } from '../../utils/datetime'
import ApiErrorMessage from '../common/ApiErrorMessage'
import Pagination from '../common/Pagination'
import { ROLE_OPTIONS } from './roleOptions'

const SIZE = 20
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]))

export default function UsersPage() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [applied, setApplied] = useState({ q: '', role: '' })
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const users = useQuery({
    queryKey: ['users', applied, page],
    queryFn: () =>
      apiFetch<Page<UserAdmin>>('/users', {
        query: { q: applied.q.trim(), role: applied.role, page, size: SIZE },
      }),
    placeholderData: (prev) => prev,
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPage(1)
    setApplied({ q, role })
  }

  const data = users.data

  return (
    <section>
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas que pueden ingresar al sistema. Solo el responsable puede crearlas."
        actions={
          <button className="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={17} /> Nuevo usuario
          </button>
        }
      />

      <form className="filters" onSubmit={onSubmit} noValidate>
        <label>
          Buscar
          <input value={q} placeholder="Nombre, usuario o código" onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          Rol
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-actions">
          <button type="submit" className="primary">
            <Icon name="search" size={16} /> Buscar
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setQ('')
              setRole('')
              setApplied({ q: '', role: '' })
              setPage(1)
            }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {users.isLoading && <TableSkeleton />}
      {users.isError && <ApiErrorMessage error={users.error} />}
      {data && data.items.length === 0 && (
        <EmptyState icon="users" title="Sin usuarios">
          No hay usuarios que coincidan con la búsqueda.
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Código</th>
                  <th>Rol</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>
                      <code>{u.username}</code>
                    </td>
                    <td>{u.institutional_id}</td>
                    <td>
                      {ROLE_LABEL[u.role]}
                      {u.requester_type && (
                        <span className="muted"> · {u.requester_type === 'DOCENTE' ? 'Docente' : 'Estudiante'}</span>
                      )}
                    </td>
                    <td>{formatDateTime(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} size={data.size} total={data.total} onChange={setPage} />
        </>
      )}

      {creating && <UserModal onClose={() => setCreating(false)} />}
    </section>
  )
}
