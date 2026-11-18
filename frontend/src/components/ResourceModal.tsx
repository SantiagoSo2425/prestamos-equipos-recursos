import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import type { Category, Resource, ResourceStatus } from '../api/types'
import ApiErrorMessage from '../pages/common/ApiErrorMessage'
import { fieldError } from '../pages/common/errors'
import { statusLabel } from '../pages/common/status'
import { useToast } from './toast-context'

const CODE_PATTERN = /^[A-Z]{3,5}-\d{3,4}$/
const STATUSES: ResourceStatus[] = ['ACTIVO', 'EN_REVISION', 'DADO_DE_BAJA']

interface Props {
  /** Si se indica, el modal edita ese recurso; si no, crea uno nuevo. */
  resource?: Resource
  onClose: () => void
}

/** Alta y edición de recursos en una ventana modal (se abre desde el catálogo). */
export default function ResourceModal({ resource, onClose }: Props) {
  const editing = !!resource
  const queryClient = useQueryClient()
  const toast = useToast()

  const [code, setCode] = useState(resource?.code ?? '')
  const [name, setName] = useState(resource?.name ?? '')
  const [description, setDescription] = useState(resource?.description ?? '')
  const [categoryId, setCategoryId] = useState(resource ? String(resource.category.id) : '')
  const [teacherOnly, setTeacherOnly] = useState(resource?.teacher_only ?? false)
  const [status, setStatus] = useState<ResourceStatus>(resource?.status ?? 'ACTIVO')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<Category[]>('/categories'),
  })

  const save = useMutation({
    mutationFn: () => {
      if (editing) {
        return apiFetch<Resource>(`/resources/${resource.id}`, {
          method: 'PATCH',
          body: {
            name: name.trim(),
            description: description.trim() || null,
            category_id: Number(categoryId),
            teacher_only: teacherOnly,
            status,
          },
        })
      }
      return apiFetch<Resource>('/resources', {
        method: 'POST',
        body: {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || null,
          category_id: Number(categoryId),
          teacher_only: teacherOnly,
        },
      })
    },
    onSuccess: () => {
      toast.success(editing ? 'Recurso actualizado.' : 'Recurso creado.')
      void queryClient.invalidateQueries({ queryKey: ['resources'] })
      void queryClient.invalidateQueries({ queryKey: ['resource'] })
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
    if (!editing && !CODE_PATTERN.test(code.trim()))
      v.code = 'Formato inválido. Ejemplo: PORT-001 (3 a 5 letras mayúsculas, guion y 3 o 4 dígitos).'
    if (!name.trim()) v.name = 'El nombre es obligatorio.'
    if (name.trim().length > 120) v.name = 'El nombre no puede superar 120 caracteres.'
    if (description.length > 1000) v.description = 'La descripción no puede superar 1000 caracteres.'
    if (!categoryId) v.category_id = 'Selecciona una categoría.'
    setErrors(v)
    if (Object.keys(v).length === 0) save.mutate()
  }

  const shown = (f: string) => errors[f] ?? fieldError(save.error, f)

  return (
    <div className="overlay" role="presentation">
      <div
        className="dialog dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Editar recurso' : 'Nuevo recurso'}
      >
        <h2>{editing ? 'Editar recurso' : 'Nuevo recurso'}</h2>
        <p className="muted" style={{ marginTop: '-0.3rem' }}>
          {editing
            ? 'Actualiza los datos o el estado operativo del recurso.'
            : 'Registra un nuevo equipo en el inventario.'}
        </p>
        <form className="form" onSubmit={onSubmit} noValidate>
          <label>
            Código
            <input
              value={code}
              disabled={editing}
              placeholder="PORT-001"
              autoFocus={!editing}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            {shown('code') && <span className="field-error">{shown('code')}</span>}
          </label>
          <label>
            Nombre
            <input
              value={name}
              maxLength={120}
              autoFocus={editing}
              onChange={(e) => setName(e.target.value)}
            />
            {shown('name') && <span className="field-error">{shown('name')}</span>}
          </label>
          <label>
            Descripción
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            {shown('description') && <span className="field-error">{shown('description')}</span>}
          </label>
          <label>
            Categoría
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Selecciona…</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (máx. {c.max_loan_hours} h)
                </option>
              ))}
            </select>
            {shown('category_id') && <span className="field-error">{shown('category_id')}</span>}
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={teacherOnly}
              onChange={(e) => setTeacherOnly(e.target.checked)}
            />
            Solo para docentes
          </label>
          {editing && (
            <label>
              Estado operativo
              <select value={status} onChange={(e) => setStatus(e.target.value as ResourceStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
              {shown('status') && <span className="field-error">{shown('status')}</span>}
            </label>
          )}

          {save.isError && <ApiErrorMessage error={save.error} />}

          <div className="actions">
            <button type="button" className="ghost" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={save.isPending}>
              {save.isPending && <span className="spinner" />}
              {save.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear recurso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
