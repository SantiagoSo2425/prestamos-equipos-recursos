interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  max?: string
  min?: string
  required?: boolean
  hint?: string
}

/** Campo fecha/hora local (hora de Bogotá). El valor es el de `datetime-local`. */
export default function DateTimeField({ label, value, onChange, max, min, required, hint }: Props) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="datetime-local"
        value={value}
        max={max}
        min={min}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <small>{hint}</small>}
    </label>
  )
}
