import { useState } from 'react'
import ErrorAlert from './ErrorAlert'

interface Props {
  title: string
  message?: string
  confirmLabel: string
  /** Si se define, se muestra un campo de texto (obligatorio con `textRequired`). */
  textLabel?: string
  textRequired?: boolean
  minLength?: number
  busy?: boolean
  error?: unknown
  onConfirm: (text: string) => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  textLabel,
  textRequired,
  minLength = 0,
  busy,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const [text, setText] = useState('')
  const trimmed = text.trim()
  const invalid = Boolean(textLabel && textRequired && trimmed.length < Math.max(1, minLength))

  return (
    <div className="overlay" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        {textLabel && (
          <label className="field">
            <span>{textLabel}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} />
            {textRequired && minLength > 0 && <small>Mínimo {minLength} caracteres.</small>}
          </label>
        )}
        <ErrorAlert error={error} />
        <div className="actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || invalid}
            onClick={() => onConfirm(trimmed)}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
