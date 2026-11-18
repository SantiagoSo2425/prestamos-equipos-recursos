import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Condition, Loan } from '../../api/types'
import DateTimeField from '../../components/DateTimeField'
import ErrorAlert from '../../components/ErrorAlert'
import { localInputToIso, nowForInput } from '../../utils/format'

interface Props {
  loanId: number
  onDone?: (loan: Loan) => void
  onCancel?: () => void
}

/** Formulario «Registrar devolución» (ACTIVA/VENCIDA → DEVUELTA). */
export default function ReturnForm({ loanId, onDone, onCancel }: Props) {
  const qc = useQueryClient()
  const [returnedAt, setReturnedAt] = useState('')
  const [condition, setCondition] = useState<Condition>('BUENO')
  const [notes, setNotes] = useState('')
  const damaged = condition === 'CON_DANO'

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<Loan>(`/loans/${loanId}/return`, {
        method: 'POST',
        body: {
          returned_at: localInputToIso(returnedAt),
          return_condition: condition,
          return_notes: notes.trim() || null,
        },
      }),
    onSuccess: (loan) => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loan', loanId] })
      onDone?.(loan)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Registrar devolución</h2>
      <DateTimeField
        label="Fecha y hora real de devolución"
        value={returnedAt}
        onChange={setReturnedAt}
        max={nowForInput()}
        hint="Déjala vacía para usar el momento actual."
      />
      <label className="field">
        <span>Estado del recurso al devolverlo</span>
        <select value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
          <option value="BUENO">Bueno</option>
          <option value="CON_DANO">Con daño</option>
        </select>
      </label>
      {damaged && (
        <div className="alert alert-warn">
          El recurso pasará a <strong>revisión</strong> y no estará disponible hasta que se habilite de nuevo.
        </div>
      )}
      <label className="field">
        <span>Observaciones{damaged ? ' (obligatorias)' : ''}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          required={damaged}
          placeholder={damaged ? 'Describe el daño encontrado' : 'Opcional'}
        />
      </label>
      <ErrorAlert error={mutation.error} />
      <div className="actions">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={mutation.isPending}>
            Cancelar
          </button>
        )}
        <button className="primary" disabled={mutation.isPending || (damaged && !notes.trim())}>
          {mutation.isPending ? 'Registrando…' : 'Registrar devolución'}
        </button>
      </div>
    </form>
  )
}
