import type { ReactNode } from 'react'

export interface Column<T> {
  header: string
  render: (row: T) => ReactNode
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  page?: number
  size?: number
  total?: number
  onPageChange?: (page: number) => void
  empty?: string
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  page = 1,
  size = 20,
  total,
  onPageChange,
  empty = 'No hay registros.',
}: Props<T>) {
  const pages = total !== undefined ? Math.max(1, Math.ceil(total / size)) : 1
  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.header}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={rowKey(r)}>
                  {columns.map((c) => (
                    <td key={c.header}>{c.render(r)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {onPageChange && pages > 1 && (
        <nav className="pager" aria-label="Paginación">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Anterior
          </button>
          <span>
            Página {page} de {pages}
          </span>
          <button disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            Siguiente
          </button>
        </nav>
      )}
    </div>
  )
}
