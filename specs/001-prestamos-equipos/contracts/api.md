# Contrato de API REST — v1

**Base URL**: `http://localhost:8000/api` | **Formato**: JSON UTF-8 | **Fechas**: ISO 8601 con zona
(`2026-11-20T08:00:00-05:00`) | **Auth**: `Authorization: Bearer <jwt>` en todo salvo `/auth/login`.

> **Acuerdo de equipo**: este contrato se revisa y aprueba por ambas personas en el PR de fundación
> **antes** de paralelizar historias. Cambios posteriores requieren PR que actualice este archivo y
> `frontend/src/api/types.ts` en el mismo cambio, con revisión del otro integrante.
> La especificación OpenAPI viva la genera FastAPI en `/docs` y `/openapi.json`.

Leyenda de roles: **S** = SOLICITANTE, **R** = RESPONSABLE, **C** = COORDINACION.
Dueño(A/B) = persona que implementa el endpoint.

## Resumen de endpoints

| # | Método | Ruta | Roles | Descripción | Req. | Dueño |
|---|---|---|---|---|---|---|
| 1 | POST | `/auth/login` | público | Inicia sesión, devuelve JWT | FR-001 | A |
| 2 | GET | `/auth/me` | S R C | Usuario autenticado | FR-002 | A |
| 3 | GET | `/categories` | S R C | Lista categorías y duración máxima | FR-005 | A |
| 4 | GET | `/resources` | S R C | Catálogo con disponibilidad y filtros | FR-005–007 | A |
| 5 | GET | `/resources/{id}` | S R C | Detalle + periodos ocupados | FR-008 | A |
| 6 | POST | `/resources` | R | Registrar recurso | FR-034 | A |
| 7 | PATCH | `/resources/{id}` | R | Editar datos / estado operativo | FR-034–035 | A |
| 8 | POST | `/loans` | S | Registrar solicitud | FR-009–016 | A |
| 9 | GET | `/loans` | S(propias) R C | Listar/filtrar solicitudes e historial | FR-016, FR-030, FR-032 | A |
| 10 | GET | `/loans/{id}` | S(dueño) R C | Detalle de la operación | FR-016, FR-025 | A |
| 11 | POST | `/loans/{id}/cancel` | S(dueño) | Cancelar | FR-017 | A |
| 12 | POST | `/loans/{id}/approve` | R | Aprobar | FR-018, FR-020–021 | B |
| 13 | POST | `/loans/{id}/reject` | R | Rechazar con motivo | FR-019 | B |
| 14 | POST | `/loans/{id}/deliver` | R | Registrar entrega → ACTIVA | FR-022–025 | B |
| 15 | POST | `/loans/{id}/return` | R | Registrar devolución → DEVUELTA | FR-026–028 | B |
| 16 | GET | `/loans/{id}/movements` | S(dueño) R C | Historial de movimientos | FR-029–030 | B |
| 17 | GET | `/dashboard/summary` | R C | Totales y préstamos activos/vencidos | FR-031 | A |
| 18 | GET | `/dashboard/usage` | R C | Uso por recurso y categoría en rango | FR-031–032 | A |

## Errores (todas las rutas)

```json
{ "detail": "El recurso ya está reservado en ese periodo.", "code": "OVERLAP" }
```

```json
{
  "detail": "Datos inválidos.",
  "code": "VALIDATION_ERROR",
  "fields": [{ "field": "end_at", "message": "Debe ser posterior a la fecha de inicio." }]
}
```

| HTTP | `code` | Cuándo |
|---|---|---|
| 401 | `NOT_AUTHENTICATED` / `INVALID_CREDENTIALS` / `TOKEN_EXPIRED` | sin token, login fallido, token vencido |
| 403 | `FORBIDDEN` | rol no permitido o recurso ajeno |
| 403 | `TEACHER_ONLY` | estudiante solicita recurso solo docentes |
| 404 | `NOT_FOUND` | id inexistente (o ajeno para S, para no filtrar existencia) |
| 409 | `OVERLAP`, `LIMIT_REACHED`, `OVERDUE_BLOCK`, `INVALID_TRANSITION`, `RESOURCE_NOT_AVAILABLE`, `DUPLICATE_CODE`, `RESOURCE_IN_USE`, `START_PASSED` | reglas de negocio |
| 422 | `VALIDATION_ERROR` | formato/campos inválidos |
| 500 | `INTERNAL_ERROR` | mensaje genérico, sin trazas |

## Esquemas compartidos

```ts
type Role = "SOLICITANTE" | "RESPONSABLE" | "COORDINACION";
type RequesterType = "ESTUDIANTE" | "DOCENTE";
type ResourceStatus = "ACTIVO" | "EN_REVISION" | "DADO_DE_BAJA";
type LoanStatus = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "CANCELADA" | "ACTIVA" | "DEVUELTA";
type EffectiveStatus = LoanStatus | "VENCIDA";
type Condition = "BUENO" | "CON_DANO";

interface UserRef { id: number; username: string; full_name: string }
interface User extends UserRef { role: Role; requester_type: RequesterType | null; institutional_id: string }
interface Category { id: number; name: string; max_loan_hours: number }

interface Resource {
  id: number; code: string; name: string; description: string | null;
  category: Category; status: ResourceStatus; teacher_only: boolean;
  available: boolean | null;          // null si no se envió rango from/to
  unavailable_reason: "PRESTADO" | "RESERVADO" | "NO_ACTIVO" | null;
}
interface ResourceDetail extends Resource {
  busy_periods: { loan_id: number; start_at: string; end_at: string | null; status: LoanStatus }[];
  // end_at null = préstamo vencido sin devolver (ocupación abierta)
}

interface Loan {
  id: number; resource: { id: number; code: string; name: string; category: string };
  requester: UserRef & { requester_type: RequesterType };
  start_at: string; end_at: string; purpose: string;
  status: LoanStatus; effective_status: EffectiveStatus;
  rejection_reason: string | null;
  approved_by: UserRef | null; approved_at: string | null;
  delivered_by: UserRef | null; delivered_at: string | null; checkout_condition: string | null;
  received_by: UserRef | null; returned_at: string | null;
  return_condition: Condition | null; return_notes: string | null;
  is_late: boolean; days_overdue: number;   // 0 si no está vencido
  created_at: string; updated_at: string;
}
interface Movement {
  id: number; actor: UserRef; from_status: LoanStatus | null; to_status: LoanStatus;
  note: string | null; created_at: string;
}
interface Page<T> { items: T[]; total: number; page: number; size: number }
```

## Detalle por endpoint

### 1. `POST /auth/login`

Request `{ "username": "est.ana", "password": "Demo1234!" }` → **200**
`{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 3600, "user": User }`.
Errores: 401 `INVALID_CREDENTIALS` (mensaje igual para usuario inexistente o clave errada), 422.

### 2. `GET /auth/me` → **200** `User`. 401 si token ausente/inválido.

### 3. `GET /categories` → **200** `Category[]`.

### 4. `GET /resources`

Query: `category_id?`, `q?` (código/nombre), `status?`, `from?`, `to?` (ambos o ninguno),
`available_only?=false`, `page=1`, `size=20 (≤100)`. Para S se excluyen `DADO_DE_BAJA`.
→ **200** `Page<Resource>`. 422 si `from >= to` o solo uno de los dos.

### 5. `GET /resources/{id}` → **200** `ResourceDetail` (periodos APROBADA/ACTIVA futuros o en curso).
404 `NOT_FOUND`.

### 6. `POST /resources` (R)

Request `{ "code": "PORT-005", "name": "Portátil Lenovo T14", "description": "...", "category_id": 1,
"teacher_only": false }` → **201** `Resource`. 409 `DUPLICATE_CODE`, 422, 403.

### 7. `PATCH /resources/{id}` (R)

Request parcial `{ name?, description?, category_id?, teacher_only?, status? }` → **200** `Resource`.
409 `RESOURCE_IN_USE` si pasa a `EN_REVISION`/`DADO_DE_BAJA` con préstamo ACTIVA. 404, 422, 403.
`code` no es editable.

### 8. `POST /loans` (S)

Request `{ "resource_id": 1, "start_at": "...", "end_at": "...", "purpose": "Práctica de laboratorio de redes" }`
→ **201** `Loan` (status `PENDIENTE`) + movimiento `null → PENDIENTE`.
Errores en orden de evaluación: 422 (V1, V2) → 404 recurso → 409 `RESOURCE_NOT_AVAILABLE` (V3) →
403 `TEACHER_ONLY` (V4) → 409 `OVERDUE_BLOCK` (V5) → 409 `LIMIT_REACHED` (V6) → 409 `OVERLAP` (V7).
R/C → 403 `FORBIDDEN`.

### 9. `GET /loans`

Query: `status?` (acepta `VENCIDA`), `resource_id?`, `category_id?`, `requester_id?` (solo R/C),
`from?`, `to?` (solapamiento con el periodo del préstamo), `page`, `size`, `sort=-created_at`.
S siempre filtrado a sus propias operaciones. → **200** `Page<Loan>`.

### 10. `GET /loans/{id}` → **200** `Loan`. 404 si no existe o (para S) no es suyo.

### 11. `POST /loans/{id}/cancel` (S dueño)

Request `{ "note"?: string }` → **200** `Loan` (CANCELADA). 409 `INVALID_TRANSITION` si no está
PENDIENTE/APROBADA. 404 si no es suyo.

### 12. `POST /loans/{id}/approve` (R)

Request `{ "note"?: string }` → **200** `Loan` (APROBADA). Con bloqueo `FOR UPDATE` del recurso y del
solicitante revalida V3–V7. Errores: 409 `INVALID_TRANSITION`, `START_PASSED`, `OVERLAP`,
`LIMIT_REACHED`, `OVERDUE_BLOCK`, `RESOURCE_NOT_AVAILABLE`; 403 S/C; 404.

### 13. `POST /loans/{id}/reject` (R)

Request `{ "reason": "El recurso está reservado para el evento institucional." }` (5–500) →
**200** `Loan` (RECHAZADA). 422 sin motivo; 409 `INVALID_TRANSITION`; 403; 404.

### 14. `POST /loans/{id}/deliver` (R)

Request `{ "delivered_at"?: string (default now, no futura), "checkout_condition": "Completo, con cargador" }`
→ **200** `Loan` (ACTIVA). 409 `INVALID_TRANSITION`, `RESOURCE_NOT_AVAILABLE` (recurso no ACTIVO o
con otro préstamo ACTIVA); 422; 403; 404.

### 15. `POST /loans/{id}/return` (R)

Request `{ "returned_at"?: string (default now, ≥ delivered_at), "return_condition": "BUENO" | "CON_DANO", "return_notes"?: string }`
(`return_notes` obligatorio si `CON_DANO`) → **200** `Loan` (DEVUELTA, `is_late` calculado). Si
`CON_DANO`: recurso → `EN_REVISION` (y se registra en la nota del movimiento). 409
`INVALID_TRANSITION`; 422; 403; 404.

### 16. `GET /loans/{id}/movements` → **200** `Movement[]` ordenados por `created_at` asc.

### 17. `GET /dashboard/summary` (R, C)

→ **200**
```json
{
  "loans_by_status": { "PENDIENTE": 3, "APROBADA": 2, "RECHAZADA": 1, "CANCELADA": 1, "ACTIVA": 2, "VENCIDA": 1, "DEVUELTA": 5 },
  "resources_by_status": { "ACTIVO": 10, "EN_REVISION": 1, "DADO_DE_BAJA": 1 },
  "active_loans": [ "Loan (ACTIVA no vencida)" ],
  "overdue_loans": [ "Loan (VENCIDA) con days_overdue" ]
}
```
(`loans_by_status.ACTIVA` excluye las vencidas.)

### 18. `GET /dashboard/usage` (R, C)

Query `from`, `to` (default últimos 30 días), `category_id?` → **200**
```json
{
  "by_category": [{ "category": "Portátil", "loans": 7, "hours": 120.5 }],
  "by_resource": [{ "resource_id": 1, "code": "PORT-001", "name": "...", "loans": 3, "hours": 40.0, "last_loan_at": "..." }]
}
```
Cuenta operaciones entregadas (ACTIVA/DEVUELTA) que se solapan con el rango.
