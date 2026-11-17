# Research — Gestión de préstamos de equipos y recursos

**Feature**: `001-prestamos-equipos` | **Fecha**: 2026-11-16

Cada decisión sigue el formato Decisión / Justificación / Alternativas. No quedan elementos
`NEEDS CLARIFICATION` en el contexto técnico.

---

## R1. Arquitectura general

- **Decisión**: Cliente-servidor con dos proyectos en un mismo repositorio: `frontend/` (SPA React)
  y `backend/` (API REST FastAPI) más PostgreSQL. El frontend solo se comunica con la API por HTTP/JSON.
- **Justificación**: La guía exige separación visible frontend–API–BD y comunicación real. Un monorepo
  simplifica trazabilidad y PRs para un equipo de 2.
- **Alternativas**: Next.js fullstack (difumina la separación); dos repositorios (más fricción).

## R2. Organización del backend en capas

- **Decisión**: `api/` (routers, solo HTTP) → `services/` (casos de uso y reglas de negocio) →
  `models/` (SQLAlchemy) + `schemas/` (Pydantic). Las reglas viven en `services/` y `domain/`, nunca
  en routers ni en el frontend.
- **Justificación**: Principio II de la constitución (reglas en el servidor) y permite que dos personas
  trabajen en routers/servicios distintos sin conflictos.
- **Alternativas**: Lógica en routers (difícil de probar y de reutilizar); repository pattern
  completo (complejidad innecesaria, Principio VII).

## R3. Prevención de asignaciones incompatibles (concurrencia)

- **Decisión**: Doble barrera:
  1. **Aplicación**: en aprobar/entregar se bloquea la fila del recurso con `SELECT ... FOR UPDATE`
     y se verifica solapamiento, estado del recurso y reglas del solicitante dentro de la misma
     transacción.
  2. **Base de datos**: restricción de exclusión PostgreSQL (`btree_gist`):
     `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
     WHERE (status IN ('APROBADA','ACTIVA'))`. Si dos transacciones compiten, la segunda falla y se
     traduce a `409 OVERLAP`.
- **Justificación**: FR-021 exige consistencia ante operaciones simultáneas; la restricción garantiza
  integridad incluso ante errores de la aplicación. El rango semiabierto `[)` hace que periodos
  contiguos no se consideren solapados (caso límite de la spec).
- **Alternativas**: Solo verificación en aplicación (condición de carrera); bloqueo a nivel de tabla
  (degrada concurrencia); nivel de aislamiento SERIALIZABLE global (reintentos complejos).

## R4. Préstamos vencidos y ocupación

- **Decisión**: `VENCIDA` no se almacena: es un **estado efectivo** calculado
  (`status == ACTIVA and end_at < now()`), expuesto en la API como `effective_status`. Un préstamo
  vencido ocupa el recurso **hasta su devolución** (ocupación abierta), por lo que la verificación de
  disponibilidad en aplicación lo trata como `[start_at, +∞)`.
- **Justificación**: Evita procesos programados (supuesto de la spec), mantiene una sola fuente de
  verdad y la disponibilidad siempre coherente con la realidad física (CA-01).
- **Alternativas**: Job programado que cambie a VENCIDA (infraestructura extra, estados desfasados).

## R5. Modelo de estados y movimientos

- **Decisión**: Una sola entidad `Loan` (solicitud/préstamo) con máquina de estados explícita en
  `domain/loan_states.py` (tabla de transiciones permitidas por acción y rol). Cada transición escribe
  un `LoanMovement` inmutable en la misma transacción.
- **Justificación**: La spec describe una operación única que recorre el ciclo; una tabla de
  transiciones es fácil de documentar, probar y explicar en la sustentación.
- **Alternativas**: Tablas separadas Solicitud/Préstamo (duplica datos y joins); event sourcing
  (excesivo).

## R6. Diseño REST de transiciones

- **Decisión**: Recurso `loans` con CRUD limitado (`POST`, `GET`) y **acciones como sub-recursos**
  `POST /api/loans/{id}/approve|reject|deliver|return|cancel`. No hay `DELETE` de préstamos.
- **Justificación**: Cada transición tiene reglas, permisos y datos propios; un `PATCH status`
  genérico ocultaría las reglas. La constitución pide CRUD solo cuando el proceso lo justifica.
- **Alternativas**: `PATCH /loans/{id}` con `status` (validación ambigua por campo); recursos
  separados `/approvals`, `/deliveries` (más rutas sin beneficio real).

## R7. Formato de errores y códigos HTTP

- **Decisión**: Cuerpo uniforme `{"detail": str, "code": str, "fields"?: [{"field","message"}]}`.
  Códigos: 200/201 éxito, 204 sin contenido, 401 sin autenticación, 403 rol/propiedad o
  `TEACHER_ONLY`, 404 inexistente, 409 regla de negocio (`OVERLAP`, `LIMIT_REACHED`, `OVERDUE_BLOCK`,
  `INVALID_TRANSITION`, `RESOURCE_NOT_AVAILABLE`, `DUPLICATE_CODE`, `RESOURCE_IN_USE`),
  422 validación de datos (`VALIDATION_ERROR`). Manejadores globales ocultan trazas (500 genérico).
- **Justificación**: Principio IV; facilita documentar las pruebas con método y código HTTP.
- **Alternativas**: 400 para todo (menos expresivo); errores por defecto de FastAPI (formato no
  uniforme).

## R8. Autenticación y autorización

- **Decisión**: Login con usuario/contraseña → JWT de acceso (HS256, expiración 60 min) firmado con
  `JWT_SECRET` de `.env`. Contraseñas con `bcrypt` (vía `passlib[bcrypt]`). Autorización con
  dependencias FastAPI `get_current_user` y `require_roles(...)`; la propiedad (solicitante solo ve lo
  suyo) se aplica en los servicios filtrando por `requester_id`. Token guardado en `sessionStorage` en
  el frontend y enviado como `Authorization: Bearer`.
- **Justificación**: Decisión del usuario (JWT + roles); simple y suficiente para pruebas 6 y
  acciones no autorizadas. `sessionStorage` limita la persistencia a la pestaña.
- **Alternativas**: Cookies httpOnly + CSRF (más seguro pero más complejo para el alcance); refresh
  tokens (fuera de alcance).

## R9. Librería JWT

- **Decisión**: `PyJWT`.
- **Justificación**: Mantenida activamente, API mínima; `python-jose` tiene menor mantenimiento.

## R10. Persistencia y migraciones

- **Decisión**: SQLAlchemy 2.x (estilo tipado `Mapped[]`, sesiones síncronas) + driver `psycopg`
  v3 + Alembic. Migración inicial crea extensión `btree_gist`, tablas, CHECKs y la restricción de
  exclusión. Script `seed.py` idempotente con datos ficticios.
- **Justificación**: Síncrono es más simple de explicar y suficiente para la escala; Alembic da
  reproducibilidad de la BD (requisito del repositorio).
- **Alternativas**: Async SQLAlchemy (complejidad sin necesidad); `create_all` sin migraciones (no
  reproducible ni versionado).

## R11. Frontend

- **Decisión**: React 18 + Vite + TypeScript, React Router v6, **TanStack Query** para estado del
  servidor, cliente `fetch` propio (`src/api/client.ts`) que adjunta el token y normaliza errores,
  formularios con validación en cliente (mensajes por campo) y CSS simple con variables (sin
  framework de UI pesado). Tipos de la API escritos a mano en `src/api/types.ts` a partir de los
  contratos.
- **Justificación**: TanStack Query gestiona carga/error/refresco (estados de interfaz que pide la
  guía) con poco código. Sin librerías UI pesadas para mantener el foco.
- **Alternativas**: Redux (sobredimensionado); generación automática de cliente OpenAPI (paso extra
  de herramientas).

## R12. Estrategia de pruebas

- **Decisión**: **Principal**: pruebas funcionales documentadas (PF-01…PF-12 de la guía + casos
  adicionales) ejecutadas con Swagger UI (`/docs`) y una colección de cliente HTTP
  (`docs/pruebas/prestamos.http` para REST Client/Thunder Client), evidencias en `evidencias/`.
  **Complementaria (opcional)**: `pytest` + `TestClient` para las reglas críticas (solapamiento,
  transiciones, permisos) sobre una BD de prueba.
- **Justificación**: Principio V y la guía (no se exige automatización, pero ayuda a no romper reglas).
- **Alternativas**: Solo manual (riesgo de regresiones); E2E con Playwright (fuera de alcance).

## R13. Entorno local en Windows

- **Decisión**: Ejecutar herramientas como módulos de Python (`python -m uvicorn`, `python -m alembic`,
  `python -m pip`) en lugar de los `.exe` de `Scripts/`; PostgreSQL 16 instalado nativo **o** un
  contenedor solo para la BD (`docker run postgres:16`) — Docker es opcional, no requisito.
- **Justificación**: En la máquina de desarrollo una política de Control de Aplicaciones bloquea
  ejecutables no firmados (observado con `specify.exe`).

## R14. Reparto de trabajo para dos personas

- **Decisión**: Reparto **vertical por historias de usuario** (cada persona hace backend + frontend +
  pruebas de sus historias), precedido de una fase de fundación dividida por capas y de la
  aprobación conjunta de los contratos (`contracts/`).
- **Justificación**: Cada integrante muestra aportes verificables en todas las capas (criterio 15 %
  Git y sustentación individual); los contratos acordados permiten paralelizar sin bloqueos.
- **Alternativas**: Backend/Frontend por persona (integración concentrada al final, aportes
  desbalanceados por capa).
