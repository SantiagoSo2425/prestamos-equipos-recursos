# Matriz de trazabilidad

Criterio de aceptación → requisitos → historia → implementación → pull request → prueba funcional.
Cada integrante edita solo sus filas. Equivalencia de identificadores: `FR-0NN` (spec) = `RF-NN`.

| CA | Requisitos | Historia | Backend | Frontend | PR | Pruebas |
|---|---|---|---|---|---|---|
| CA-01 Catálogo y disponibilidad | RF-05, RF-06, RF-07, RF-08 | US1 | `api/resources.py`, `api/categories.py`, `services/resources.py`, `schemas/resource.py` | `/catalogo`, `/catalogo/:id` (`pages/catalog/`) | _#pendiente_ | PF-01, PF-02 |
| CA-02 Registro de solicitudes | RF-09…RF-17 | US2 | `api/loans.py` (POST, cancel, GET, movements), `services/loans.py`, `schemas/loan.py`, `schemas/movement.py` | `/solicitudes/nueva`, `/mis-solicitudes`, `MovementTimeline` (`pages/requests/`, `pages/loans/`) | _#pendiente_ | PF-03, PF-04 |
| CA-03 Evaluación de solicitudes | RF-18, RF-19, RF-20, RF-21 | US3 | _B_ | _B_ | _B_ | PF-05, PF-06 |
| CA-04 Entrega y préstamo activo | RF-22…RF-25 | US4 | _B_ | _B_ | _B_ | PF-07, PF-08, PF-09 |
| CA-05 Devolución e historial | RF-26…RF-30 | US5 | _B_ | _B_ | _B_ | PF-10 |
| CA-06 Consulta consolidada | RF-31, RF-32, RF-33 | US6 | `api/dashboard.py`, `services/dashboard.py`, `schemas/dashboard.py` | `/tablero`, `/historial` (`pages/dashboard/`) | _#pendiente_ | PF-11 |
| Administración de recursos | RF-34, RF-35, RF-36 | US7 | `api/resources.py` (POST, PATCH), `services/resources.py` | `/recursos/nuevo`, `/recursos/:id/editar` (`pages/resources/`) | _#pendiente_ | PF-13, PF-14 |
| Autenticación y roles | RF-01, RF-02, RF-03 | F1A | `api/auth.py`, `security.py`, `deps.py`, `errors.py` | `auth/` (login, `ProtectedRoute`) | [#2](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/2) | PF-06 (permisos) |

Los números de PR marcados como _pendiente_ se completan al abrir cada pull request.
