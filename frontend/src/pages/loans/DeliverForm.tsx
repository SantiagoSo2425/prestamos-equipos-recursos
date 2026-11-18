import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Loan } from '../../api/types'
import DateTimeField from '../../components/DateTimeField'
import ErrorAlert from '../../components/ErrorAlert'
import { localInputToIso, nowForInput } from '../../utils/format'

interface Props {
  loanId: number
  onDone?: (loan: Loan) => void
  onCancel?: () => void
}

/** Formulario «Registrar entrega» (APROBADA → ACTIVA). */
export default function DeliverForm({ loanId, onDone, onCancel }: Props) {
  const qc = useQueryClient()
  const [deliveredAt, setDeliveredAt] = useState('')
  const [condition, setCondition] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<Loan>(`/loans/${loanId}/deliver`, {
        method: 'POST',
        body: { delivered_at: localInputToIso(deliveredAt), checkout_condition: condition },
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
      <h2>Registrar entrega</h2>
      <DateTimeField
        label="Fecha y hora real de entrega"
        value={deliveredAt}
        onChange={setDeliveredAt}
        max={nowForInput()}
        hint="Déjala vacía para usar el momento actual."
      />
      <label className="field">
        <span>Condición del recurso al salir</span>
        <textarea
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          rows={3}
          maxLength={500}
          required
          placeholder="Ej.: Completo, con cargador y funda"
        />
      </label>
      <ErrorAlert error={mutation.error} />
      <div className="actions">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={mutation.isPending}>
            Cancelar
          </button>
        )}
        <button className="primary" disabled={mutation.isPending || !condition.trim()}>
          {mutation.isPending ? 'Registrando…' : 'Registrar entrega'}
        </button>
      </div>
    </form>
  )
}
