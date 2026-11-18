# Gestión de préstamos de equipos y recursos

Aplicación web cliente-servidor para gestionar el ciclo completo de préstamo de equipos y recursos:
catálogo y disponibilidad → solicitud → evaluación → entrega → devolución → historial y tablero de
coordinación. Proyecto final (PF-03).

## 1. Información general

| Integrante | Rol en el proyecto | Aportes |
|---|---|---|
| Santiago (Persona A) | Backend de auth, catálogo, solicitudes, recursos y tablero; frontend de login, catálogo, solicitudes, administración y tablero | Fundación F1A, US1, US2, US7, US6 |
| Persona B | Modelo de datos, migración, semillas, reglas de negocio, flujo de evaluación/entrega/devolución, layout | F1B, US3, US4, US5 |

Reparto detallado: [`specs/001-prestamos-equipos/tasks.md`](specs/001-prestamos-equipos/tasks.md).

## 2. Descripción del sistema

Tres roles con permisos distintos:

- **SOLICITANTE** (estudiante o docente): consulta el catálogo, registra y cancela sus solicitudes.
- **RESPONSABLE**: administra recursos, aprueba/rechaza solicitudes, registra entregas y devoluciones.
- **COORDINACION**: consulta de solo lectura (tablero e historial consolidados).

Reglas principales (se validan siempre en el servidor): una solicitud no puede solaparse con otra
aprobada o activa del mismo recurso, un estudiante tiene como máximo 2 préstamos aprobados/activos y
un docente 5, quien tenga un préstamo vencido no puede solicitar, y los recursos "solo docentes" no
se prestan a estudiantes. Un préstamo activo cuya fecha fin pasó se considera **vencido** y ocupa el
recurso hasta su devolución.

## 3. Requisitos

Especificación completa en [`specs/001-prestamos-equipos/spec.md`](specs/001-prestamos-equipos/spec.md)
y análisis de requisitos en [`docs/requisitos.md`](docs/requisitos.md) (RF-01…RF-38, RNF, historias y
supuestos sin confirmar).

## 4. Arquitectura

Detalle (diagramas, modelo de datos, máquina de estados y permisos) en [`docs/diseno.md`](docs/diseno.md).
Resumen: SPA React (Vite + TypeScript, React Router,
TanStack Query) que consume una API REST FastAPI (capas `api → services → models`) sobre PostgreSQL 16.
La incompatibilidad de asignaciones se garantiza con bloqueo de filas y una restricción de exclusión
de rangos (`btree_gist`). Contrato en [`contracts/api.md`](specs/001-prestamos-equipos/contracts/api.md).

## 5. Configuración del entorno

Requisitos: Python 3.12, Node.js ≥ 20, PostgreSQL 16. Pasos detallados en
[`quickstart.md`](specs/001-prestamos-equipos/quickstart.md).

```powershell
# Backend
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env          # completar DATABASE_URL, JWT_SECRET y SEED_PASSWORD locales
.\.venv\Scripts\python -m alembic upgrade head
.\.venv\Scripts\python -m app.seed
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
Copy-Item .env.example .env          # VITE_API_URL=http://localhost:8000/api
npm run dev
```

El archivo `.env` nunca se versiona; `.env.example` no contiene secretos reales. La documentación
interactiva de la API queda en `http://localhost:8000/docs`.

## 6. Endpoints

Tabla contrastada con el OpenAPI generado por la aplicación (`/docs`, `/openapi.json`); además existe
`GET /api/health` para comprobar que el servicio está activo.

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | Inicia sesión y devuelve el JWT |
| GET | `/api/auth/me` | todos | Usuario autenticado |
| GET | `/api/categories` | todos | Categorías y duración máxima |
| GET | `/api/resources` | todos | Catálogo con disponibilidad y filtros |
| GET | `/api/resources/{id}` | todos | Detalle y periodos ocupados |
| POST | `/api/resources` | RESPONSABLE | Registrar recurso |
| PATCH | `/api/resources/{id}` | RESPONSABLE | Editar datos o estado operativo |
| POST | `/api/loans` | SOLICITANTE | Registrar solicitud |
| GET | `/api/loans` | todos (S solo propias) | Listar y filtrar solicitudes e historial |
| GET | `/api/loans/{id}` | dueño / R / C | Detalle de la operación |
| POST | `/api/loans/{id}/cancel` | SOLICITANTE dueño | Cancelar solicitud |
| GET | `/api/loans/{id}/movements` | dueño / R / C | Historial de movimientos |
| POST | `/api/loans/{id}/approve` | RESPONSABLE | Aprobar |
| POST | `/api/loans/{id}/reject` | RESPONSABLE | Rechazar con motivo |
| POST | `/api/loans/{id}/deliver` | RESPONSABLE | Registrar entrega |
| POST | `/api/loans/{id}/return` | RESPONSABLE | Registrar devolución |
| GET | `/api/dashboard/summary` | RESPONSABLE, COORDINACION | Totales y préstamos activos/vencidos |
| GET | `/api/dashboard/usage` | RESPONSABLE, COORDINACION | Uso por categoría y recurso |

Errores con formato uniforme `{ "detail", "code", "fields"? }` (401, 403, 404, 409, 422, 500).

## 7. Pruebas y evidencias

Pruebas funcionales documentadas PF-01…PF-14 en [`docs/pruebas.md`](docs/pruebas.md), peticiones
reproducibles en [`docs/pruebas/prestamos.http`](docs/pruebas/prestamos.http) y evidencias en
`evidencias/PF-XX/`. Scripts reproducibles contra la BD real: `backend/scripts/verify_a.py` (PF-01…04, 11,
13, 14 y ciclo completo) y `backend/scripts/smoke_flow.py` (PF-05…10); matriz de permisos con
`python -m pytest tests/test_permissions.py`. Trazabilidad criterio → requisito → código → PR → prueba en
[`docs/trazabilidad.md`](docs/trazabilidad.md).

## 8. Control de versiones

Ramas por unidad de trabajo (`feat/...`) integradas a `develop` mediante pull request con revisión
del otro integrante; `main` recibe solo versiones estables. Commits en español con estilo
Conventional Commits y referencia al requisito. Pull requests: [#1](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/1)
(spec y plan), [#2](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/2) (autenticación),
[#3](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/3) (catálogo, solicitudes, recursos y
tablero) y [#4](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/4) (datos, reglas y flujo
aprobar/entregar/devolver).

## 9. Conclusiones y limitaciones

**Conclusiones.** El sistema cubre el ciclo completo de préstamo (CA-01…CA-06) con las reglas aplicadas en
el servidor y respaldadas por la base de datos: una restricción de exclusión de rangos en PostgreSQL impide
asignaciones solapadas incluso con aprobaciones simultáneas. Las pruebas PF-01…PF-14 se ejecutaron contra
PostgreSQL con la semilla, y el rendimiento con 200+ recursos y 2.000+ operaciones cumple SC-008 (ver
`evidencias/SC-008-rendimiento.txt`).

**Limitaciones.**

- Los supuestos de negocio (duración máxima por categoría y límites de 2 estudiante / 5 docente) están
  pendientes de validación con el docente; ver `docs/requisitos.md`.
- No hay gestión de usuarios desde la interfaz (se cargan con la semilla), recuperación de contraseña,
  notificaciones ni integración con inventarios externos.
- El estado «vencido» se calcula al consultar; no hay procesos programados ni avisos automáticos.
- Las pruebas funcionales se ejecutan con scripts y `pytest` contra la BD real, pero no hay una suite
  automatizada completa (reglas de concurrencia, T089) ni integración continua.
- Una solicitud corresponde a una sola unidad de recurso.
