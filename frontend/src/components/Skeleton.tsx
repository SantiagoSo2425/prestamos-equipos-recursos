/** Marcadores de carga con brillo, para evitar saltos de diseño mientras llegan los datos. */
export function Skeleton({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <div className="skeleton" style={{ width, height }} aria-hidden="true" />
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="resource-grid" role="status" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="resource-card">
          <Skeleton width={44} height={44} />
          <Skeleton width="70%" height={18} />
          <Skeleton width="45%" />
          <Skeleton height={36} />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-wrap" role="status" aria-label="Cargando">
      <table>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td>
                <Skeleton width="80%" />
              </td>
              <td>
                <Skeleton width="60%" />
              </td>
              <td>
                <Skeleton width={70} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
