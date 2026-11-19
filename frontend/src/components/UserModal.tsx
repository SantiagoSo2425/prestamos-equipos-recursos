import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import type { RequesterType, Role, UserAdmin } from '../api/types'
import { ROLE_OPTIONS } from '../pages/users/roleOptions'
import ApiErrorMessage from '../pages/common/ApiErrorMessage'
import { fieldError } from '../pages/common/errors'
import Icon from './Icon'
import { useToast } from './toast-context'

const USERNAME = /^[a-z0-9._]{3,50}$/

/** Alta de usuarios en una ventana modal (solo el responsable). */
export default function UserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [institutionalId, setInstitutionalId] = useState('')
  const [role, setRole] = useState<Role>('SOLICITANTE')
  const [requesterType, setRequesterType] = useState<RequesterType>('ESTUDIANTE')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: () =>
      apiFetch<UserAdmin>('/users', {
        method: 'POST',
        body: {
          username: username.trim(),
          full_name: fullName.trim(),
          institutional_id: institutionalId.trim(),
          password,
          role,
          requester_type: role === 'SOLICITANTE' ? requesterType : null,
        },
      }),
    onSuccess: (u) => {
      toast.success(`Usuario «${u.username}» creado.`)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !save.isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, save.isPending])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const v: Record<string, string> = {}
    if (!USERNAME.test(username.trim()))
      v.username = 'Usa de 3 a 50 caracteres: minúsculas, números, punto o guion bajo.'
    if (fullName.trim().length < 3) v.full_name = 'Escribe el nombre completo (mínimo 3 caracteres).'
    if (!institutionalId.trim()) v.institutional_id = 'El código institucional es obligatorio.'
    if (password.length < 8) v.password = 'La contraseña debe tener al menos 8 caracteres.'
    setErrors(v)
    if (Object.keys(v).length === 0) save.mutate()
  }

  const clear = (f: string) => setErrors((e) => ({ ...e, [f]: '' }))
  const shown = (f: string) => errors[f] ?? fieldError(save.error, f)

  return (
    <div className="overlay" role="presentation">
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-label="Nuevo usuario">
        <h2>Nuevo usuario</h2>
        <p className="muted" style={{ marginTop: '-0.3rem' }}>
          Crea una cuenta y entrégale la contraseña inicial a la persona.
        </p>
        <form className="form" onSubmit={onSubmit} noValidate>
          <label>
            Nombre completo
            <input value={fullName} maxLength={120} autoFocus onChange={(e) => {
                setFullName(e.target.value)
                clear('full_name')
              }} />
            {shown('full_name') && <span className="field-error">{shown('full_name')}</span>}
          </label>
          <label>
            Usuario
            <input
              value={username}
              maxLength={50}
              placeholder="est.ana"
              autoComplete="off"
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase())
                clear('username')
              }}
            />
            {shown('username') && <span className="field-error">{shown('username')}</span>}
          </label>
          <label>
            Código institucional
            <input
              value={institutionalId}
              maxLength={20}
              placeholder="E1001"
              onChange={(e) => {
                setInstitutionalId(e.target.value.toUpperCase())
                clear('institutional_id')
              }}
            />
            {shown('institutional_id') && <span className="field-error">{shown('institutional_id')}</span>}
          </label>
          <label>
            Rol
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {shown('role') && <span className="field-error">{shown('role')}</span>}
          </label>
          {role === 'SOLICITANTE' && (
            <label>
              Tipo de solicitante
              <select value={requesterType} onChange={(e) => setRequesterType(e.target.value as RequesterType)}>
                <option value="ESTUDIANTE">Estudiante</option>
                <option value="DOCENTE">Docente</option>
              </select>
              {shown('requester_type') && <span className="field-error">{shown('requester_type')}</span>}
            </label>
          )}
          <label>
            Contraseña inicial
            <span style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                style={{ flex: 1 }}
                type={showPassword ? 'text' : 'password'}
                value={password}
                maxLength={128}
                autoComplete="new-password"
                onChange={(e) => {
                  setPassword(e.target.value)
                  clear('password')
                }}
              />
              <button
                type="button"
                className="ghost sm"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((s) => !s)}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
              </button>
            </span>
            {shown('password') && <span className="field-error">{shown('password')}</span>}
          </label>

          {save.isError && <ApiErrorMessage error={save.error} />}

          <div className="actions">
            <button type="button" className="ghost" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={save.isPending}>
              {save.isPending && <span className="spinner" />}
              {save.isPending ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
