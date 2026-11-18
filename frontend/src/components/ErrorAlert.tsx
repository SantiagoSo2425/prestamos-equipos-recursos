import { ApiError } from '../api/client'

/** Muestra el mensaje del API y, si los hay, los errores por campo. */
export default function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null
  const api = error instanceof ApiError ? error : null
  return (
    <div className="alert alert-error" role="alert">
      <strong>{api ? api.detail : 'Ocurrió un error inesperado.'}</strong>
      {api && api.fields.length > 0 && (
        <ul>
          {api.fields.map((f) => (
            <li key={`${f.field}-${f.message}`}>
              {f.field ? <code>{f.field}</code> : null} {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
