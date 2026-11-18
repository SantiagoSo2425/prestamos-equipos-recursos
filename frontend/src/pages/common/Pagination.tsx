interface Props {
  page: number
  size: number
  total: number
  onChange: (page: number) => void
}

export default function Pagination({ page, size, total, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return <p className="pager">{total} resultado(s)</p>
  return (
    <nav className="pager" aria-label="Paginación">
      <button className="secondary sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {pages} · {total} resultados
      </span>
      <button className="secondary sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Siguiente
      </button>
    </nav>
  )
}
