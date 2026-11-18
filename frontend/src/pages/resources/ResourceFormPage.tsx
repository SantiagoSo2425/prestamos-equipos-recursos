import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'
import type { Category, Resource, ResourceDetail, ResourceStatus } from '../../api/types'
import ApiErrorMessage from '../common/ApiErrorMessage'
import { fieldError } from '../common/errors'
import { statusLabel } from '../common/status'

const CODE_PATTERN = /^[A-Z]{3,5}-\d{3,4}$/
const STATUSES: ResourceStatus[] = ['ACTIVO', 'EN_REVISION', 'DADO_DE_BAJA']

export default function ResourceFormPage() {
  const { id } = useParams()
  const existing = useQuery({
    queryKey: ['resource', id],
    queryFn: () => apiFetch<ResourceDetail>(`/resources/${id}`),
    enabled: !!id,
    retry: false,
  })

  if (id && existing.isLoading) return <main>Cargando…</main>
  if (id && existing.isError)
    return (
      <main>
        <ApiErrorMessage error={existing.error} />
        <Link to="/catalogo">Volver al catálogo</Link>
      </main>
    )
  return <ResourceForm id={id} initial={existing.data} />
}

function ResourceForm({ id, initial }: { id?: string; initial?: ResourceDetail }) {
  const editing = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState(initial ? String(initial.category.id) : '')
  const [teacherOnly, setTeacherOnly] = useState(initial?.teacher_only ?? false)
  const [status, setStatus] = useState<ResourceStatus>(initial?.status ?? 'ACTIVO')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<Category[]>('/categories'),
  })

  const save = useMutation({
    mutationFn: () => {
      if (editing) {
        return apiFetch<Resource>(`/resources/${id}`, {
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
      void queryClient.invalidateQueries({ queryKey: ['resources'] })
      void queryClient.invalidateQueries({ queryKey: ['resource'] })
      navigate('/catalogo')
    },
  })

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
    <main>
      <h1>{editing ? 'Editar recurso' : 'Nuevo recurso'}</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        <label>
          Código
          <input
            value={code}
            disabled={editing}
            placeholder="PORT-001"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {shown('code') && <span className="field-error">{shown('code')}</span>}
        </label>
        <label>
          Nombre
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
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
          <button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <Link className="btn secondary" to="/catalogo">
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  )
}
