import { ApiError } from '../../api/client'

/** Muestra el error de la API (mensaje y errores por campo). */
export default function ApiErrorMessage({ error }: { error: unknown }) {
  if (!error) return null
  const e = error instanceof ApiError ? error : null
  return (
    <div role="alert" className="alert error">
      <strong>{e ? e.detail : 'Ocurrió un error inesperado.'}</strong>
      {e && e.fields.length > 0 && (
        <ul>
          {e.fields.map((f, i) => (
            <li key={i}>
              {f.field ? `${f.field}: ` : ''}
              {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
