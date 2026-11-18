---

description: "Lista de tareas para dos personas: sistema de préstamos de equipos (PF-03)"
---

# Tasks: Gestión de préstamos de equipos y recursos

**Input**: Documentos de diseño en `specs/001-prestamos-equipos/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Tests**: Las **pruebas funcionales documentadas** (PF-01…PF-12) son obligatorias y aparecen en
cada historia. Las pruebas automatizadas son **opcionales** y están en la fase final.

**Organization**: Tareas agrupadas por historia de usuario y asignadas por persona.

## Formato: `- [ ] [ID] [P?] [Story?] [Owner] Descripción con ruta`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[USn]**: historia de usuario de [spec.md](spec.md)
- **[A]** = Santiago · **[B]** = Persona B · **[AB]** = ambos (pareja o revisión conjunta)
- **Rama**: indicada en cada fase; se integra a `main` por PR con aprobación del otro integrante
- **🔄 SYNC**: punto de sincronización (ambos deben haber mergeado antes de seguir)
- **PF-XX**: prueba funcional mínima de la guía (Actividad 6)

## Path Conventions

- Backend: `backend/app/...` · Frontend: `frontend/src/...` · Docs: `docs/...` · Evidencias: `evidencias/PF-XX/`

## Resumen de carga

| Persona | Fases | Historias | Pruebas PF |
|---|---|---|---|
| A (Santiago) | F1A auth/esqueleto + `LoanOut`/lectura de préstamos | US1, US2, US7, US6 | PF-01, 02, 03, 04, 11 |
| B | F1B datos/layout (PR base temprano) | US3, US4, US5 | PF-05, 06, 07, 08, 09, 10 |
| AB | F0 acuerdo, integración | — | PF-12 |

---

## Phase 1: Setup — Acuerdo inicial (F0) 🔄

**Rama**: `001-prestamos-equipos` → PR "Especificación y plan" a `main` · **Dueño**: AB

**Purpose**: Repositorio, reglas de colaboración y contrato aprobado antes de paralelizar.

- [x] T001 [A] Crear repositorio en GitHub con `gh repo create`, subir `main` y la rama `001-prestamos-equipos`, e invitar a Persona B como colaboradora
- [ ] T002 [A] Configurar protección de `main` en GitHub (requerir PR y 1 aprobación, sin push directo) y documentar la regla en `docs/contribucion.md`
- [x] T003 [P] [B] Crear plantilla de PR en `.github/pull_request_template.md` con secciones: Propósito, Cambios, Requisitos (RF/CA), Pruebas efectuadas (PF-XX + evidencia), Checklist de constitución (reglas en servidor, permisos por rol, sin secretos, trazabilidad actualizada)
- [x] T004 [P] [A] Crear estructura de carpetas raíz `backend/`, `frontend/`, `docs/`, `docs/pruebas/`, `evidencias/` (con `.gitkeep`) según plan.md
- [ ] T005 [AB] Revisar y aprobar en el PR de F0 el contrato `specs/001-prestamos-equipos/contracts/api.md` y las firmas de "Contratos internos entre personas" de `plan.md` (cada uno deja comentario de aprobación)
- [x] T006 [B] Redactar `docs/requisitos.md` (Act. 2): registro de entrevista (preguntas, respuestas, acuerdos, pendientes), actores, RF-01…RF-38 (equivalencia `FR-0NN`→`RF-NN` de spec.md), RNF (seguridad, rendimiento SC-008, usabilidad), historias US1–US7 con criterios de aceptación, priorización y supuestos sin confirmar (duraciones por categoría, límites 2/5)
- [x] T007 [AB] Merge del PR F0 a `main` tras revisión cruzada

**🔄 SYNC-0**: contrato aprobado y `main` con spec/plan. Ambos crean sus ramas de fundación desde `main`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Ninguna historia empieza hasta completar F1A y F1B.

### F1A — Esqueleto backend + autenticación (Persona A) · Rama `feat/f1a-auth`

- [x] T008 [A] Crear `backend/requirements.txt` con versiones fijadas: fastapi, uvicorn[standard], pydantic, pydantic-settings, sqlalchemy>=2, alembic, psycopg[binary]>=3, PyJWT, passlib[bcrypt], python-multipart, pytest, httpx
- [x] T009 [P] [A] Crear `backend/.env.example` (sin secretos reales) con `DATABASE_URL=postgresql+psycopg://prestamos:<password>@localhost:5432/prestamos`, `JWT_SECRET=<cambiar>`, `JWT_EXPIRE_MINUTES=60`, `CORS_ORIGINS=http://localhost:5173`, `SEED_PASSWORD=<demo>`, `TZ_NAME=America/Bogota`
- [x] T010 [A] Implementar settings en `backend/app/config.py` con `pydantic-settings` leyendo `.env`
- [x] T011 [A] Implementar `backend/app/errors.py`: clase `AppError(status, code, detail, fields=None)` y handlers globales que respondan `{"detail", "code", "fields"?}`; convertir `RequestValidationError` a 422 `VALIDATION_ERROR` con `fields[{field,message}]` en español; 404/405 de Starlette a `NOT_FOUND`; excepciones no controladas a 500 `INTERNAL_ERROR` sin trazas (log solo en servidor)
- [x] T012 [A] Implementar `backend/app/security.py`: `hash_password`/`verify_password` (bcrypt) y `create_access_token`/`decode_token` (PyJWT HS256, `sub`=user id, `role`, `exp` según `JWT_EXPIRE_MINUTES`); token vencido → `AppError(401,"TOKEN_EXPIRED")`
- [x] T013 [A] Implementar `backend/app/deps.py`: `get_current_user` (Bearer obligatorio → 401 `NOT_AUTHENTICATED`; usuario inactivo → 401) y `require_roles(*roles)` (→ 403 `FORBIDDEN`) (depende de T012 y del modelo `User` de T025)
- [x] T014 [A] Crear `backend/app/schemas/auth.py` (`LoginIn{username,password}`, `TokenOut{access_token,token_type,expires_in,user}`, `UserOut`) y `backend/app/schemas/common.py` (`Page[T]{items,total,page,size}`, `UserRef`)
- [x] T015 [A] Implementar `backend/app/api/auth.py`: `POST /api/auth/login` (401 `INVALID_CREDENTIALS` con mismo mensaje para usuario inexistente o clave errada) y `GET /api/auth/me`
- [x] T016 [A] Crear `backend/app/main.py`: FastAPI con título/descr. en español, CORS desde settings, registro de handlers de T011, routers bajo prefijo `/api`, `GET /api/health` → `{"status":"ok"}`
- [x] T017 [P] [A] Inicializar frontend en `frontend/` con Vite (React + TypeScript), dependencias `react-router-dom@6`, `@tanstack/react-query@5`; crear `frontend/.env.example` con `VITE_API_URL=http://localhost:8000/api`
- [x] T018 [A] Implementar `frontend/src/api/client.ts`: `apiFetch<T>(path, {method, body, query})` que agrega `Authorization: Bearer` desde `sessionStorage`, serializa JSON, y lanza `ApiError{status, code, detail, fields}`; en 401 limpia sesión y redirige a `/login`
- [x] T019 [A] Crear `frontend/src/api/types.ts` con todos los tipos de "Esquemas compartidos" de `contracts/api.md` (Role, LoanStatus, EffectiveStatus, Resource, ResourceDetail, Loan, Movement, Page…)
- [x] T020 [A] Implementar `frontend/src/auth/AuthContext.tsx` (`useAuth()`: user, login, logout, hasRole) y `frontend/src/auth/ProtectedRoute.tsx` (redirige a `/login` sin sesión; muestra "No autorizado" si el rol no aplica)
- [x] T021 [A] Implementar `frontend/src/auth/LoginPage.tsx` con validación de campos vacíos, mensaje de error del API y redirección según rol (SOLICITANTE→`/catalogo`, RESPONSABLE→`/gestion`, COORDINACION→`/tablero`)
- [x] T091 [A] Crear `backend/app/schemas/loan.py` sección A con `LoanOut` completo según contrato (incluye `effective_status`, `days_overdue`, refs de usuarios) y `LoanFilters`; **adelantado a F1A** porque B lo necesita desde US3
- [x] T092 [A] Implementar en `backend/app/services/loans.py` `list_loans` (SOLICITANTE solo propias; filtros `status` incl. `VENCIDA`, `resource_id`, `category_id`, `requester_id` solo R/C, `from`/`to`, paginación, `sort=-created_at`) y `get_loan` (404 si no existe o es ajena para SOLICITANTE); **adelantado a F1A**
- [x] T093 [A] Implementar en `backend/app/api/loans.py` `GET /api/loans` y `GET /api/loans/{id}`; **adelantado a F1A** (B los usa en la bandeja `/gestion` y en `LoanDetailPage`)
- [x] T022 [A] Abrir PR `feat/f1a-auth` (Revisor: B) con evidencia de login exitoso/fallido en `/docs` (la evidencia requiere el PR base de B, ver T094)

### F1B — Datos, reglas compartidas y layout (Persona B) · Ramas `feat/f1b-base` (primero) y `feat/f1b-datos`

- [x] T023 [B] Implementar `backend/app/database.py`: engine desde `DATABASE_URL`, `SessionLocal`, `Base` (DeclarativeBase) y dependencia `get_db` con commit/rollback
- [x] T024 [P] [B] Crear enums en `backend/app/models/enums.py`: `UserRole(SOLICITANTE, RESPONSABLE, COORDINACION)`, `RequesterType(ESTUDIANTE, DOCENTE)`, `ResourceStatus(ACTIVO, EN_REVISION, DADO_DE_BAJA)`, `LoanStatus(PENDIENTE, APROBADA, RECHAZADA, CANCELADA, ACTIVA, DEVUELTA)`, `ItemCondition(BUENO, CON_DANO)`
- [x] T025 [P] [B] Crear modelo `User` en `backend/app/models/user.py`: `username varchar(50) único`, `full_name varchar(120)`, `institutional_id varchar(20) único`, `password_hash varchar(255)`, `role`, `requester_type` nulo, `is_active default true`, `created_at`; CHECK `(role = 'SOLICITANTE') = (requester_type IS NOT NULL)`
- [x] T026 [P] [B] Crear modelos `Category` (`name varchar(50) único`, `max_loan_hours integer > 0`) y `Resource` (`code varchar(20) único` con patrón `^[A-Z]{3,5}-\d{3,4}$`, `name varchar(120)`, `description text ≤ 1000`, `category_id FK`, `status default ACTIVO`, `teacher_only default false`, timestamps; índices `category_id`, `status`) en `backend/app/models/category.py` y `backend/app/models/resource.py`
- [x] T027 [P] [B] Crear modelo `Loan` en `backend/app/models/loan.py` con todas las columnas de data-model.md (`purpose varchar(500)` ≥10, `rejection_reason varchar(500)`, `checkout_condition varchar(500)`, `return_notes varchar(1000)`, `is_late default false`, FKs approved_by/delivered_by/received_by) y CHECKs: `end_at > start_at`; `status <> 'RECHAZADA' OR rejection_reason IS NOT NULL`; `status NOT IN ('ACTIVA','DEVUELTA') OR delivered_at IS NOT NULL`; `status <> 'DEVUELTA' OR (returned_at IS NOT NULL AND return_condition IS NOT NULL)`; índices `(resource_id,status)`, `(requester_id,status)`, `(status,end_at)`, `created_at`; propiedad `effective_status` (VENCIDA si ACTIVA y `end_at < now`)
- [x] T028 [P] [B] Crear modelo `LoanMovement` en `backend/app/models/movement.py` (`loan_id FK`, `actor_id FK`, `from_status` nulo, `to_status`, `note varchar(1000)`, `created_at`; índice `(loan_id, created_at)`) y exportar todos en `backend/app/models/__init__.py`
- [x] T029 [B] Configurar Alembic (`backend/alembic.ini`, `backend/alembic/env.py` leyendo settings) y crear migración inicial `backend/alembic/versions/0001_initial.py` que ejecute `CREATE EXTENSION IF NOT EXISTS btree_gist`, cree enums/tablas/CHECKs y la restricción `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN ('APROBADA','ACTIVA'))` con nombre `loans_no_overlap`
- [x] T030 [B] Implementar `backend/app/domain/loan_states.py`: tabla de transiciones de data-model.md (create, approve, reject, cancel, deliver, return con estados origen/destino y rol) y `assert_transition(loan, action, user)` que lance `AppError(409,"INVALID_TRANSITION")` o `AppError(403,"FORBIDDEN")`
- [x] T031 [B] Implementar `backend/app/services/movements.py`: `record(db, loan, actor, from_status, to_status, note=None)` (solo inserción, sin update/delete)
- [x] T032 [B] Implementar `backend/app/services/rules.py`: `find_overlaps(db, resource_id, start, end, exclude_loan_id=None)` (APROBADA/ACTIVA con rango `[)`; ACTIVA vencida ocupa `[start_at, +∞)`), `is_available(...)`, `lock_resource(db, id)` y `lock_user(db, id)` (`SELECT … FOR UPDATE`), y `check_can_request(db, user, resource, start, end, exclude_loan_id=None)` aplicando en orden V1 (`start_at >= now`, `end_at > start_at`), V2 (duración ≤ `max_loan_hours`), V3 (recurso `ACTIVO` → 409 `RESOURCE_NOT_AVAILABLE`), V4 (`teacher_only` ⇒ DOCENTE → 403 `TEACHER_ONLY`), V5 (sin vencidos → 409 `OVERDUE_BLOCK`), V6 (APROBADAS+ACTIVAS < ESTUDIANTE 2 / DOCENTE 5 → 409 `LIMIT_REACHED`), V7 (sin solape → 409 `OVERLAP`); además `translate_integrity_error` que convierta violación de `loans_no_overlap` en 409 `OVERLAP`
- [x] T033 [B] Implementar `backend/app/seed.py` (idempotente, `python -m app.seed`): usuarios ficticios `est.ana`, `est.luis` (ESTUDIANTE), `doc.maria` (DOCENTE), `resp.carlos`, `coord.sofia` con `SEED_PASSWORD`; categorías Portátil 72 h, Cámara 48 h, Instrumento 24 h, Otro 72 h; ~12 recursos (`PORT-001..004`, `CAM-001..003`, `INST-001..003` con uno `teacher_only`, `OTRO-001..002`; uno EN_REVISION y uno DADO_DE_BAJA); préstamos en todos los estados incluyendo un ACTIVO vencido de `est.luis`, dos PENDIENTES solapadas del mismo recurso y uno APROBADO futuro, cada uno con sus movimientos
- [x] T034 [P] [B] Implementar `frontend/src/App.tsx` y `frontend/src/main.tsx`: `QueryClientProvider`, `AuthProvider`, rutas `/login`, `/catalogo`, `/catalogo/:id`, `/recursos/nuevo`, `/recursos/:id/editar`, `/solicitudes/nueva`, `/mis-solicitudes`, `/gestion`, `/prestamos/:id`, `/tablero`, `/historial` envueltas en `ProtectedRoute` con roles (páginas placeholder hasta cada historia)
- [x] T035 [P] [B] Implementar `frontend/src/components/Layout.tsx` + `NavBar.tsx` con menú por rol (S: Catálogo, Mis solicitudes; R: Catálogo, Gestión, Recursos, Tablero; C: Tablero, Historial) y usuario/cerrar sesión
- [x] T036 [P] [B] Implementar componentes compartidos en `frontend/src/components/`: `StatusBadge.tsx` (colores por `EffectiveStatus`/`ResourceStatus`), `ErrorAlert.tsx` (muestra `ApiError.detail` y `fields`), `DataTable.tsx` (paginación), `DateTimeField.tsx`, `ConfirmDialog.tsx` (con campo de texto opcional/obligatorio), y `frontend/src/utils/format.ts` (fechas en `America/Bogota`); estilos base en `frontend/src/styles.css`
- [ ] T094 [B] **Primero**: abrir un PR corto `feat/f1b-base` (Revisor: A) con T023–T029 y la semilla mínima de usuarios de T033, para que A pueda probar login y `deps.py` (T013, T015, T022); el resto de F1B (T030–T036) sigue en `feat/f1b-datos`
- [x] T037 [B] Abrir PR `feat/f1b-datos` (Revisor: A) con evidencia de `alembic upgrade head` + `seed` y captura de la restricción `loans_no_overlap` en la BD

**🔄 SYNC-1**: PR F1A y F1B mergeados. Desde aquí A y B trabajan en paralelo por historias.

---

## Phase 3: User Story 1 — Catálogo y disponibilidad (P1) 🎯 MVP · CA-01

**Owner**: A · **Rama**: `feat/us1-catalogo` · **Revisor**: B · **Pruebas**: PF-01, PF-02

**Goal**: Usuarios autenticados consultan recursos con disponibilidad real en un rango.

**Independent Test**: Con datos semilla, filtrar portátiles por rango y comprobar que la disponibilidad coincide con los préstamos APROBADA/ACTIVA; consultar id inexistente → 404.

- [x] T038 [P] [US1] [A] Crear `backend/app/schemas/resource.py`: `CategoryOut`, `ResourceOut` (incluye `available: bool|null`, `unavailable_reason: PRESTADO|RESERVADO|NO_ACTIVO|null`), `ResourceDetailOut` (`busy_periods[{loan_id,start_at,end_at|null,status}]`)
- [x] T039 [US1] [A] Implementar en `backend/app/services/resources.py`: `list_resources(db, user, category_id, q, status, from_, to, available_only, page, size≤100)` usando `rules.find_overlaps` (excluir `DADO_DE_BAJA` para SOLICITANTE; `from`/`to` ambos o ninguno y `from < to` → 422) y `get_resource_detail(db, id)` (404 `NOT_FOUND`)
- [x] T040 [US1] [A] Implementar `backend/app/api/categories.py` (`GET /api/categories`) y `GET /api/resources`, `GET /api/resources/{id}` en `backend/app/api/resources.py` con `get_current_user`
- [x] T041 [P] [US1] [A] Implementar `frontend/src/pages/catalog/CatalogPage.tsx`: filtros categoría, texto, rango fecha/hora y "solo disponibles"; tabla con código, nombre, categoría, `StatusBadge`, disponibilidad y motivo; botón "Solicitar" (solo SOLICITANTE, deshabilitado si no disponible o `teacher_only` para ESTUDIANTE); estados de carga/vacío/error
- [x] T042 [P] [US1] [A] Implementar `frontend/src/pages/catalog/ResourceDetailPage.tsx`: datos del recurso y lista de periodos ocupados (vencido = "hasta devolución"); mensaje controlado si 404
- [x] T043 [US1] [A] Documentar PF-01 (consulta catálogo y disponibilidad) y PF-02 (recurso inexistente → 404 `NOT_FOUND`) en `docs/pruebas.md` con plantilla completa (ID, requisito, precondiciones, pasos, datos, esperado, obtenido, estado, evidencia, método/HTTP); agregar requests a `docs/pruebas/prestamos.http`; capturas en `evidencias/PF-01/`, `evidencias/PF-02/`
- [x] T044 [US1] [A] Actualizar fila CA-01 en `docs/trazabilidad.md` y abrir PR (Revisor: B)

**Checkpoint**: MVP de consulta funcional e independiente.

---

## Phase 4: User Story 2 — Registrar solicitud (P1) · CA-02

**Owner**: A · **Rama**: `feat/us2-solicitudes` · **Revisor**: B · **Pruebas**: PF-03, PF-04
**Depende de**: US1 (botón "Solicitar"), F1B (`rules`, `movements`, `loan_states`), F1A (`LoanOut`, lectura de préstamos: T091–T093)

**Goal**: Solicitante registra, consulta y cancela sus solicitudes con todas las reglas V1–V7.

**Independent Test**: `est.ana` crea solicitud válida → PENDIENTE recuperable; casos inválidos (fechas, propósito, solo docentes, `est.luis` vencido, límite) → rechazados sin persistir.

- [x] T045 [P] [US2] [A] Agregar en `backend/app/schemas/loan.py` (sección A): `LoanCreate{resource_id, start_at, end_at, purpose(10–500)}` con validador `end_at > start_at` y `CancelIn{note?}` (`LoanOut` y `LoanFilters` ya están en T091)
- [x] T046 [US2] [A] Implementar en `backend/app/services/loans.py`: `create_loan` (rol SOLICITANTE; `lock_user` + `rules.check_can_request`; estado PENDIENTE; `movements.record(None→PENDIENTE)`) y `cancel_loan` (`list_loans`/`get_loan` ya están en T092) (dueño; `loan_states.assert_transition('cancel')`; movimiento)
- [x] T047 [US2] [A] Implementar en `backend/app/api/loans.py` (sección A): `POST /api/loans` (201) y `POST /api/loans/{id}/cancel` (los GET ya están en T093)
- [x] T048 [P] [US2] [A] Implementar `frontend/src/pages/requests/NewRequestPage.tsx`: recurso preseleccionado desde catálogo, inicio/fin (`DateTimeField`), propósito con contador; validación en cliente (fin > inicio, no pasado, duración ≤ máx. categoría, propósito 10–500) y errores del servidor por campo con `ErrorAlert`
- [x] T049 [P] [US2] [A] Implementar `frontend/src/pages/requests/MyRequestsPage.tsx`: lista paginada propia con `StatusBadge`, motivo de rechazo visible, botón "Cancelar" (PENDIENTE/APROBADA) con `ConfirmDialog`, enlace a `/prestamos/:id`
- [x] T095 [US2] [A] Implementar `GET /api/loans/{id}/movements` en `backend/app/api/loans.py` (S dueño / R / C; orden `created_at` asc; 404 si ajeno para S) y `MovementOut` en `backend/app/schemas/movement.py`; movido desde US5 para descargar a B
- [x] T096 [P] [US2] [A] Implementar `frontend/src/pages/loans/MovementTimeline.tsx` (actor, fecha, estado anterior→nuevo, nota); B lo integra en `LoanDetailPage` (T067)
- [x] T050 [US2] [A] Documentar PF-03 (solicitud válida almacenada y recuperable, 201) y PF-04 (datos inválidos 422 / `TEACHER_ONLY` 403 / `OVERDUE_BLOCK` 409 / `LIMIT_REACHED` 409, verificando con consulta SQL que no se persistió) en `docs/pruebas.md`, `docs/pruebas/prestamos.http` y `evidencias/PF-03/`, `evidencias/PF-04/`
- [x] T051 [US2] [A] Actualizar fila CA-02 en `docs/trazabilidad.md` y abrir PR (Revisor: B)

**Checkpoint**: Solicitudes funcionales; B puede probar US3 con solicitudes reales además de semillas.

---

## Phase 5: User Story 3 — Evaluar solicitudes (P1) · CA-03

**Owner**: B · **Rama**: `feat/us3-evaluacion` · **Revisor**: A · **Pruebas**: PF-05, PF-06
**Depende de**: F1A/F1B (usa solicitudes PENDIENTES semilla y `LoanOut`/`GET /loans` de F1A: T091–T093; no espera a US2)

**Goal**: El responsable aprueba (con revalidación atómica) o rechaza con motivo.

**Independent Test**: `resp.carlos` aprueba una PENDIENTE y rechaza otra con motivo; aprobar la segunda PENDIENTE solapada → 409 `OVERLAP`; `est.ana` intenta aprobar → 403.

- [x] T052 [P] [US3] [B] Agregar en `backend/app/schemas/loan.py` (sección B): `ApproveIn{note?}`, `RejectIn{reason(5–500)}`, `DeliverIn{delivered_at?, checkout_condition(1–500)}`, `ReturnIn{returned_at?, return_condition, return_notes?(≤1000)}` con validador "return_notes obligatorio si CON_DANO"
- [x] T053 [US3] [B] Implementar en `backend/app/services/loan_workflow.py`: `approve_loan` (RESPONSABLE; `assert_transition('approve')`; si `start_at <= now` → 409 `START_PASSED`; `lock_resource` + `lock_user`; `rules.check_can_request(..., exclude_loan_id=loan.id)` revalidando V3–V7; set `approved_by/approved_at`; movimiento; capturar `IntegrityError` con `translate_integrity_error` → 409 `OVERLAP`) y `reject_loan` (desde PENDIENTE o APROBADA; `rejection_reason` obligatorio; movimiento con motivo)
- [x] T054 [US3] [B] Implementar en `backend/app/api/loans.py` (sección B): `POST /api/loans/{id}/approve` y `POST /api/loans/{id}/reject` con `require_roles("RESPONSABLE")`, devolviendo `LoanOut`
- [x] T055 [US3] [B] Implementar `frontend/src/pages/review/ReviewInboxPage.tsx` (`/gestion`): pestañas PENDIENTES / APROBADAS por entregar / ACTIVAS-VENCIDAS; para cada PENDIENTE muestra solicitante, recurso, periodo, propósito y conflictos (de `GET /resources/{id}` busy_periods); acciones Aprobar y Rechazar (motivo obligatorio vía `ConfirmDialog`); error `OVERLAP` mostrado claramente
- [x] T056 [US3] [B] Documentar PF-05 (aprobación/rechazo por RESPONSABLE con movimiento registrado, 200) y PF-06 (aprobar con token de SOLICITANTE y de COORDINACION → 403 `FORBIDDEN`, estado sin cambios) en `docs/pruebas.md`, `docs/pruebas/prestamos.http`, `evidencias/PF-05/`, `evidencias/PF-06/`
- [x] T057 [US3] [B] Actualizar fila CA-03 en `docs/trazabilidad.md` y abrir PR (Revisor: A)

**Checkpoint**: Evaluación funcional con solicitudes semilla y reales.

---

## Phase 6: User Story 4 — Entrega y préstamo activo (P1) · CA-04

**Owner**: B · **Rama**: `feat/us4-entrega` · **Revisor**: A · **Pruebas**: PF-07, PF-08, PF-09
**Depende de**: US3 (solicitudes APROBADAS; también hay semillas)

**Goal**: Registrar entrega de una APROBADA → ACTIVA, impidiendo asignaciones incompatibles; mostrar vencidos.

**Independent Test**: Entregar una APROBADA y verla ACTIVA con recurso, solicitante y responsables correctos; entregar una PENDIENTE o un recurso con otro ACTIVA → 409 y disponibilidad intacta.

- [x] T058 [US4] [B] Implementar `deliver_loan` en `backend/app/services/loan_workflow.py`: RESPONSABLE; `assert_transition('deliver')`; `lock_resource`; recurso debe estar `ACTIVO` y sin otro préstamo `ACTIVA` (→ 409 `RESOURCE_NOT_AVAILABLE`); `delivered_at` por defecto now y no futura; `checkout_condition` obligatoria; set `delivered_by`; movimiento APROBADA→ACTIVA
- [x] T059 [US4] [B] Agregar `POST /api/loans/{id}/deliver` en `backend/app/api/loans.py` (sección B) con `require_roles("RESPONSABLE")`
- [x] T060 [P] [US4] [B] Implementar `frontend/src/pages/loans/LoanDetailPage.tsx` (`/prestamos/:id`): datos completos de la operación (recurso, solicitante, periodo, estado efectivo, aprobó/entregó/recibió, condiciones, días de retraso) y, para RESPONSABLE, botones de acción según estado (Aprobar/Rechazar/Entregar/Devolver)
- [x] T061 [US4] [B] Agregar formulario "Registrar entrega" (fecha real, condición de salida) en `frontend/src/pages/loans/DeliverForm.tsx` usado desde `LoanDetailPage` y la pestaña "APROBADAS por entregar" de `ReviewInboxPage`
- [x] T062 [US4] [B] Documentar PF-07 (asignación de recurso disponible, préstamo con solicitante y recurso correctos), PF-08 (entrega/aprobación incompatible → 409 `OVERLAP`/`RESOURCE_NOT_AVAILABLE`/`INVALID_TRANSITION`, verificar por SQL que nada cambió) y PF-09 (consulta de préstamo activo y vencido con estado, responsable y recurso coherentes) en `docs/pruebas.md`, `docs/pruebas/prestamos.http`, `evidencias/PF-07..09/`
- [x] T063 [US4] [B] Actualizar fila CA-04 en `docs/trazabilidad.md` y abrir PR (Revisor: A)

---

## Phase 7: User Story 5 — Devolución e historial (P1) · CA-05

**Owner**: B · **Rama**: `feat/us5-devolucion` · **Revisor**: A · **Pruebas**: PF-10
**Depende de**: US4, T095–T096 (A)

**Goal**: Cerrar préstamos ACTIVOS/VENCIDOS, actualizar disponibilidad y consultar el historial de movimientos.

**Independent Test**: Devolver un ACTIVO en BUENO → DEVUELTA y recurso disponible; devolver con CON_DANO → recurso EN_REVISION; historial muestra creación→aprobación→entrega→devolución.

- [x] T064 [US5] [B] Implementar `return_loan` en `backend/app/services/loan_workflow.py`: RESPONSABLE; `assert_transition('return')` (ACTIVA incl. vencida); `returned_at` por defecto now y `>= delivered_at`; `is_late = returned_at > end_at`; `return_notes` obligatorio si `CON_DANO`; si `CON_DANO` → `resource.status = EN_REVISION` (anotado en el movimiento); set `received_by`; movimiento ACTIVA→DEVUELTA
- [x] T065 [US5] [B] Agregar `POST /api/loans/{id}/return` en `backend/app/api/loans.py` (sección B) (`GET .../movements` lo implementa A en T095)
- [x] T066 [P] [US5] [B] Implementar `frontend/src/pages/loans/ReturnForm.tsx` (fecha real, condición BUENO/CON_DANO, observaciones obligatorias si daño, aviso "el recurso pasará a revisión")
- [x] T067 [P] [US5] [B] Integrar `MovementTimeline` (de A, T096) en `LoanDetailPage`
- [x] T068 [US5] [B] Documentar PF-10 (devolución persistida, recurso disponible de nuevo, historial consultable; caso CON_DANO → EN_REVISION; devolver un DEVUELTA → 409) en `docs/pruebas.md`, `docs/pruebas/prestamos.http`, `evidencias/PF-10/`
- [x] T069 [US5] [B] Actualizar fila CA-05 en `docs/trazabilidad.md` y abrir PR (Revisor: A)

**Checkpoint**: Ciclo completo de préstamo operativo de extremo a extremo.

---

## Phase 8: User Story 6 — Tablero de coordinación (P2) · CA-06

**Owner**: A · **Rama**: `feat/us6-tablero` · **Revisor**: B · **Pruebas**: PF-11
**Depende de**: F1B (datos semilla en todos los estados); se enriquece con US3–US5

**Goal**: Consulta consolidada de solo lectura de recursos y préstamos.

**Independent Test**: `coord.sofia` ve totales por estado que coinciden con `SELECT status, count(*) FROM loans`; lista de vencidos con días de retraso; filtros del historial funcionan; acciones de gestión → 403.

- [x] T070 [P] [US6] [A] Crear `backend/app/schemas/dashboard.py` (`SummaryOut{loans_by_status (ACTIVA excluye vencidas, + VENCIDA), resources_by_status, active_loans, overdue_loans}`, `UsageOut{by_category[{category,loans,hours}], by_resource[{resource_id,code,name,loans,hours,last_loan_at}]}`)
- [x] T071 [US6] [A] Implementar `backend/app/services/dashboard.py`: `get_summary(db)` y `get_usage(db, from_, to, category_id)` (default últimos 30 días; cuenta operaciones ACTIVA/DEVUELTA que se solapan con el rango; horas = `coalesce(returned_at, now) - delivered_at` recortado al rango)
- [x] T072 [US6] [A] Implementar `backend/app/api/dashboard.py`: `GET /api/dashboard/summary` y `GET /api/dashboard/usage` con `require_roles("RESPONSABLE","COORDINACION")`
- [x] T073 [P] [US6] [A] Implementar `frontend/src/pages/dashboard/DashboardPage.tsx` (`/tablero`): tarjetas de totales por estado, tabla de préstamos activos y vencidos (recurso, solicitante, responsable de entrega, fin previsto, días de retraso), uso por categoría y por recurso con rango de fechas
- [x] T074 [P] [US6] [A] Implementar `frontend/src/pages/dashboard/HistoryPage.tsx` (`/historial`): `GET /api/loans` con filtros rango, estado, categoría, recurso, solicitante; enlace a detalle de solo lectura
- [x] T075 [US6] [A] Documentar PF-11 (información consolidada y consistencia: comparar totales del tablero con consultas SQL de conteo y verificar integridad referencial loans↔resources↔users↔movements) en `docs/pruebas.md`, `evidencias/PF-11/`
- [x] T076 [US6] [A] Actualizar fila CA-06 en `docs/trazabilidad.md` y abrir PR (Revisor: B)

---

## Phase 9: User Story 7 — Administración de recursos (P2)

**Owner**: A · **Rama**: `feat/us7-recursos` · **Revisor**: B · **Pruebas**: casos adicionales PF-13, PF-14
**Depende de**: US1 (reutiliza schemas/servicio de recursos). *Orden de trabajo de A: F1A → US1 → US2 → US7 → US6.*

**Goal**: El responsable registra y edita recursos y su estado operativo.

**Independent Test**: Crear `PORT-005` → aparece ACTIVO en catálogo; código duplicado → 409; pasar a EN_REVISION un recurso con ACTIVA → 409 `RESOURCE_IN_USE`.

- [x] T077 [US7] [A] Agregar a `backend/app/schemas/resource.py` `ResourceCreate{code (^[A-Z]{3,5}-\d{3,4}$), name(1–120), description?(≤1000), category_id, teacher_only=false}` y `ResourceUpdate` parcial (sin `code`)
- [x] T078 [US7] [A] Implementar en `backend/app/services/resources.py`: `create_resource` (409 `DUPLICATE_CODE`) y `update_resource` (si nuevo `status` es `EN_REVISION`/`DADO_DE_BAJA` y hay préstamo `ACTIVA` → 409 `RESOURCE_IN_USE`; sin borrado físico)
- [x] T079 [US7] [A] Agregar `POST /api/resources` (201) y `PATCH /api/resources/{id}` en `backend/app/api/resources.py` con `require_roles("RESPONSABLE")`
- [x] T080 [P] [US7] [A] Implementar `frontend/src/pages/resources/ResourceFormPage.tsx` (crear/editar, selector de categoría y estado, validación de patrón de código) y botón "Nuevo recurso"/"Editar" en `CatalogPage` visible solo para RESPONSABLE
- [x] T081 [US7] [A] Documentar PF-13 (crear recurso y duplicado → 409) y PF-14 (cambio de estado bloqueado con préstamo activo; SOLICITANTE intenta crear → 403) en `docs/pruebas.md`, `evidencias/PF-13/`, `evidencias/PF-14/`; actualizar `docs/trazabilidad.md` y abrir PR (Revisor: B)

---

## Phase 10: Integración, documentación y cierre

**Rama**: `docs/cierre` (y `fix/...` si aparecen defectos) · **Dueño**: AB

**🔄 SYNC-2**: todas las historias mergeadas en `main`.

- [ ] T082 [AB] Ejecutar PF-12 (flujo integral interfaz–API–BD): A como `est.ana` crea solicitud desde la UI → B como `resp.carlos` aprueba, entrega y recibe devolución → verificar en BD `loans` y 4 `loan_movements`; documentar en `docs/pruebas.md` con capturas en `evidencias/PF-12/` (incluye video o secuencia de capturas)
- [x] T083 [P] [B] Redactar `docs/diseno.md` (Act. 3): diagrama de componentes (frontend/API/BD), capas del backend, modelo ER (de data-model.md), máquina de estados, especificación de API (tabla + ejemplos request/response/errores, enlace a `/docs`), aplicación de reglas y permisos, prototipos/capturas de pantallas, justificación de tecnologías y correspondencia con RF
- [x] T084 [P] [B] Completar `docs/trazabilidad.md` (Act. 7): CA-01…CA-06 → RF → US → archivos/rutas → PR (#números reales) → PF-XX
- [x] T085 [A] Redactar `README.md` con las 9 secciones de la guía (información general e integrantes con aportes, descripción, requisitos, arquitectura, configuración del entorno siguiendo `quickstart.md`, tabla de endpoints reales, pruebas y evidencias, control de versiones con enlaces a PR, conclusiones y limitaciones); B aporta secciones 4 y 6 mediante PR propio
- [x] T086 [P] [AB] Revisión de seguridad: `git grep` de secretos, confirmar `.env` ignorado, errores 500 sin trazas, todos los endpoints con rol correcto según tabla de `contracts/api.md`
- [ ] T087 [AB] Ejecutar los escenarios Q1–Q11 de `quickstart.md` desde un clon limpio siguiendo solo el README (reproducibilidad) y corregir lo que falle
- [ ] T088 [AB] Preparar sustentación: guion del ciclo completo, pruebas a repetir, y resumen de aportes por persona con enlaces a commits/PR en el README

### Opcional — pruebas automatizadas (no exigidas por la guía)

- [ ] T089 [P] [B] (Opcional) `backend/tests/test_rules.py`: solapamiento `[)` contiguo, vencido ocupa abierto, límites 2/5, `OVERDUE_BLOCK`, `TEACHER_ONLY`, transiciones inválidas, aprobación concurrente (dos sesiones) → solo una APROBADA
- [x] T090 [P] [A] (Opcional) `backend/tests/test_permissions.py`: matriz rol × endpoint de `contracts/api.md` (401/403) y aislamiento de solicitudes ajenas (404)

---

## Dependencies & Execution Order

### Phase Dependencies

- **F0 (Phase 1)** → bloquea todo (SYNC-0).
- **F1A ∥ F1B (Phase 2)** → B publica primero el PR base (T094: `database`, modelos, migración, usuarios semilla); A lo necesita para probar login. Ambas bloquean historias (SYNC-1).
  - Excepción: T013 (`deps.py`) usa el modelo `User` (T025): A puede programarlo contra la interfaz acordada y probarlo tras el merge de F1B, o B prioriza T023–T025 primero.
- **Historias**: dos pistas paralelas tras SYNC-1.
- **Phase 10** → tras SYNC-2.

### Pistas por persona

```text
A: F1A(+LoanOut) ─► US1 ─► US2 ─► US7 ─► US6 ─┐
                                     ├─► SYNC-2 ─► Cierre (AB)
B: F1B-base ─► F1B ─► US3 ─► US4 ─► US5 ───────┘
```

### Dependencias entre historias

- US2 (A) → necesita US1 (A) para el botón "Solicitar"; usa `rules` de F1B.
- US3 (B) → no depende de US2, pero sí de `LoanOut`/`GET /loans` (T091–T093, F1A); trabaja con PENDIENTES semilla.
- US4 (B) → US3. US5 (B) → US4.
- US6 (A) → solo F1B (datos semilla); se valida al final con datos reales.
- US7 (A) → US1. US5 (B) → `MovementTimeline`/`GET movements` de A (T095–T096, en US2).

### Archivos compartidos (coordinar para evitar conflictos)

| Archivo | Sección A | Sección B | Regla |
|---|---|---|---|
| `backend/app/api/loans.py` | POST/GET/cancel | approve/reject/deliver/return/movements | B crea sus funciones al final del archivo; rebase antes de PR |
| `backend/app/schemas/loan.py` | LoanOut, filtros (F1A); LoanCreate (US2) | ApproveIn…ReturnIn | `LoanOut` lo define A en F1A (T091); B lo importa |
| `frontend/src/api/types.ts` | creado en F1A | — | cambios solo con actualización de `contracts/api.md` |
| `docs/trazabilidad.md`, `docs/pruebas.md` | filas CA-01/02/06, PF de A | filas CA-03/04/05, PF de B | cada uno edita solo sus filas; cada PR añade su prueba como `docs/pruebas/PF-XX.md` y se unifican en `docs/pruebas.md` al cierre |

### Within Each User Story

Schemas → servicios → endpoints → páginas → prueba funcional documentada → trazabilidad → PR con revisión cruzada.

### Parallel Opportunities

- F0: T003 ∥ T004.
- F1A ∥ F1B completas; dentro de F1B: T024–T028 (modelos) en paralelo; T034–T036 (frontend) en paralelo con backend de B.
- Tras SYNC-1, cualquier historia de A en paralelo con cualquier historia de B.
- Dentro de cada historia, las páginas frontend `[P]` pueden empezar contra el contrato mientras se termina el servicio.

---

## Parallel Example: semana de historias

```text
Persona A (feat/us1-catalogo):  T038 schemas → T039 servicio → T040 API ; en paralelo T041/T042 páginas
Persona B (feat/us3-evaluacion): T052 schemas → T053 workflow → T054 API ; en paralelo T055 bandeja
Revisión cruzada: A revisa PR de US3, B revisa PR de US1, ambos con comentario sustantivo.
```

---

## Implementation Strategy

### MVP

1. F0 → F1A ∥ F1B → US1 (A) ∥ US3 (B).
2. Validar: catálogo correcto (PF-01/02) y evaluación sobre semillas (PF-05/06).

### Incremental Delivery

1. + US2 (A) ∥ US4 (B) → solicitud real → entrega.
2. + US7 (A) ∥ US5 (B) → ciclo completo (CA-01…CA-05).
3. + US6 (A) → CA-06.
4. Cierre: PF-12, docs, README, reproducibilidad.

### Reglas de colaboración

- Una rama por fase/historia; PR pequeño y enfocado; revisión del otro integrante obligatoria.
- Commits en español, estilo Conventional Commits con requisito: `feat(loans): valida solapamiento al aprobar (RF-20, CA-03)`.
- Cada PR incluye la evidencia PF-XX de su historia y actualiza trazabilidad.
- Nada de commits genéricos ("cambios", "update") ni carga final única.

## Notes

- [P] = archivos distintos sin dependencias pendientes.
- Equivalencia de IDs: `FR-0NN` (spec) = `RF-NN` (docs/requisitos.md).
- PF-13 y PF-14 son pruebas adicionales a las 12 mínimas de la guía.
