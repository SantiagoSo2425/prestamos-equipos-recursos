# Matriz de trazabilidad

Correspondencia entre las condiciones obligatorias (CA-01 a CA-06), los requisitos aprobados, los componentes
implementados, los pull requests y las pruebas funcionales (Actividad 7 de la guía del proyecto).

- Los requisitos están definidos en [`requisitos.md`](requisitos.md) (RF-01 a RF-38).
- Las pruebas funcionales (PF) están en [`pruebas.md`](pruebas.md) y sus evidencias en [`../evidencias/`](../evidencias/).
- Equivalencia de identificadores: `FR-0NN` (spec) = `RF-NN`.
- Rutas del backend relativas a `backend/app/`; rutas del frontend relativas a `frontend/src/`.

## 1. Matriz principal (formato de la guía)

| Condición | Requisito aprobado | Implementación (ruta/componente) | Pull request | Prueba |
|---|---|---|---|---|
| **CA-01** Catálogo y disponibilidad | RF-05 catálogo con estado y restricción · RF-06 filtros y disponibilidad por rango · RF-07 regla de disponibilidad · RF-08 recurso inexistente → error controlado | **API:** `api/resources.py`, `api/categories.py`, `services/resources.py`, `schemas/resource.py` · **UI:** `/catalogo` y `/catalogo/:id` (`pages/catalog/`) | [#3](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/3) | [PF-01](pruebas/PF-01.md), [PF-02](pruebas/PF-02.md) |
| **CA-02** Registro de solicitudes | RF-09 registrar solicitud · RF-10 validación de fechas y duración · RF-11 recurso no operativo · RF-12 recurso solo docentes · RF-13 solicitante con préstamo vencido · RF-14 límite de operaciones · RF-15 solape · RF-16 estado PENDIENTE y consulta · RF-17 cancelación | **API:** `api/loans.py` (POST, cancelar, listar, movimientos), `services/loans.py`, `services/rules.py`, `schemas/loan.py`, `schemas/movement.py` · **UI:** `/solicitudes/nueva`, `/mis-solicitudes`, `MovementTimeline` (`pages/requests/`, `pages/loans/`) | [#3](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/3), [#4](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/4) (reglas y BD) | [PF-03](pruebas/PF-03.md), [PF-04](pruebas/PF-04.md) |
| **CA-03** Evaluación de solicitudes | RF-18 solo el RESPONSABLE aprueba o rechaza · RF-19 motivo de rechazo obligatorio · RF-20 revalidación al aprobar · RF-21 consistencia ante concurrencia | **API:** `services/loan_workflow.py` (`approve_loan`, `reject_loan`), `services/rules.py`, `domain/loan_states.py`, `api/loans.py` (`/approve`, `/reject`) · **BD:** restricción `loans_no_overlap` · **UI:** `/gestion` (`pages/review/ReviewInboxPage.tsx`) | [#4](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/4) | [PF-05](pruebas/PF-05-a-PF-10.md), [PF-06](pruebas/PF-05-a-PF-10.md) |
| **CA-04** Entrega y préstamo activo | RF-22 registrar entrega (APROBADA → ACTIVA) · RF-23 rechazo por estado o recurso ocupado · RF-24 préstamo VENCIDO calculado · RF-25 responsables identificados en el préstamo | **API:** `loan_workflow.deliver_loan`, `api/loans.py` (`/deliver`), restricción `loans_no_overlap` en `alembic/versions/0001_initial.py` · **UI:** `/prestamos/:id` (`pages/loans/LoanDetailPage.tsx`, `DeliverForm.tsx`) | [#4](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/4) | [PF-07](pruebas/PF-05-a-PF-10.md), [PF-08](pruebas/PF-05-a-PF-10.md), [PF-09](pruebas/PF-05-a-PF-10.md) |
| **CA-05** Devolución e historial | RF-26 registrar devolución con condición · RF-27 préstamo DEVUELTO y marca de tardía · RF-28 CON_DANO → recurso EN_REVISION · RF-29 historial de movimientos inmutable · RF-30 consulta de historiales | **API:** `loan_workflow.return_loan`, `services/movements.py`, `api/loans.py` (`/return`, `/movements`) · **UI:** `pages/loans/ReturnForm.tsx`, `MovementTimeline` | [#4](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/4) | [PF-10](pruebas/PF-05-a-PF-10.md) |
| **CA-06** Consulta consolidada | RF-31 tablero con totales, activos y vencidos · RF-32 historial filtrable · RF-33 COORDINACIÓN solo lectura | **API:** `api/dashboard.py`, `services/dashboard.py`, `schemas/dashboard.py` · **UI:** `/tablero`, `/historial` (`pages/dashboard/`) | [#3](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/3) | [PF-11](pruebas/PF-11.md) |

> **Flujo integral (CA-01 a CA-06):** [PF-12](pruebas/PF-12.md) recorre solicitud, aprobación, entrega y
> devolución por interfaz, API y base de datos. Se ejecutó en el PR
> [#5](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/5).

## 2. Requisitos transversales y adicionales

No están asociados a un criterio CA, pero sostienen el resto de la solución.

| Tema | Requisito aprobado | Implementación (ruta/componente) | Pull request | Prueba |
|---|---|---|---|---|
| Autenticación y roles | RF-01 inicio de sesión · RF-02 roles · RF-03 el solicitante solo ve lo suyo · RF-04 operaciones no autorizadas rechazadas | `api/auth.py`, `security.py`, `deps.py`, `errors.py` · UI: `auth/` (login y `ProtectedRoute`) | [#2](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/2) | [PF-06](pruebas/PF-05-a-PF-10.md) (permisos), `tests/test_permissions.py` |
| Administración de recursos (US7) | RF-34 alta y edición con código único · RF-35 bloqueo de baja con préstamo activo · RF-36 sin eliminar, solo dar de baja | `api/resources.py` (POST, PATCH), `services/resources.py` · UI: `/recursos/nuevo`, `/recursos/:id/editar` (`pages/resources/`) | [#3](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/3) | [PF-13](pruebas/PF-13.md), [PF-14](pruebas/PF-14.md) |
| Persistencia e integridad | Datos relacionales y no solape de operaciones del mismo recurso | `alembic/versions/0001_initial.py`, `models/`, restricción `EXCLUDE USING gist` (`loans_no_overlap`) | [#4](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/4), [#5](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/5) | PF-08, [PF-12](pruebas/PF-12.md), `scripts/verify_a.py` |
| Rendimiento (SC-008) | Consultas del catálogo y del tablero con tiempos aceptables | Índices y consultas de `services/dashboard.py` y `services/resources.py` | [#5](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/5) | [`evidencias/SC-008/`](../evidencias/) |

## 3. Pruebas automatizadas, integración continua y despliegue

La guía no las exige; se añadieron para proteger las reglas en cada cambio y para publicar la solución.

| Componente | Descripción | Implementación | Pull request |
|---|---|---|---|
| Pruebas automatizadas | 102 pruebas de `pytest` sobre PostgreSQL: permisos, reglas de negocio y flujo aprobar/entregar/devolver | `backend/tests/test_permissions.py`, `test_rules.py`, `test_workflow_api.py` | [#6](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/6) |
| Integración continua | Job de backend (pytest + PostgreSQL) y de frontend (lint + build), exigidos para fusionar a `main` | `.github/workflows/ci.yml` | [#6](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/6) |
| Contenedores y despliegue en Azure | Imagen del backend en ACR, App Service para la API y Static Web Apps para la interfaz, con OIDC | `backend/Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy.yml`, [`despliegue.md`](despliegue.md) | [#7](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/7), [#9](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/9) |
| Rediseño de la interfaz | Sistema de diseño, avisos, esqueletos de carga y confirmaciones | `frontend/src/index.css`, `components/` | [#8](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/8) |
| Documentación | README, requisitos, diseño, pruebas, despliegue y documento de sustentación | `README.md`, `docs/` | [#10](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/10), [#11](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/11), [#12](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/12) |

## 4. Pull requests

| PR | Autor | Base | Contenido |
|---|---|---|---|
| [#1](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/1) | Santiago | `main` | Especificación, plan, contrato de API y tareas |
| [#2](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/2) | Santiago | `develop` | Esqueleto del backend, autenticación y lectura de préstamos |
| [#3](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/3) | Santiago | `develop` | Catálogo, solicitudes, administración de recursos y tablero |
| [#4](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/4) | Juan Carlos | `develop` | Base de datos, reglas y flujo aprobar/entregar/devolver |
| [#5](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/5) | Santiago | `develop` | Verificación en PostgreSQL, PF-12, requisitos y diseño |
| [#6](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/6) | Juan Carlos | `develop` | Pruebas automatizadas y GitHub Actions |
| [#7](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/7) | Santiago | `develop` | Despliegue en Azure con contenedores |
| [#8](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/8) | Santiago | `develop` | Rediseño de la interfaz |
| [#9](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/9) | Santiago | `main` | Release (aprobado por `@JuanMR1017`) |
| [#10](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/10) | Santiago | `develop` | Subject OIDC con identificadores inmutables |
| [#11](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/11) | Santiago | `develop` | README completo según la guía |
| [#12](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/12) | Santiago | `develop` | Documento de sustentación |

## 5. Cobertura

- **CA-01 a CA-06:** cada uno tiene requisitos, implementación en API e interfaz, PR y al menos una prueba funcional.
- **Requisitos:** RF-01 a RF-36 aparecen en la matriz. RF-37 (reglas en el servidor) y RF-38 (mensajes de error
  comprensibles) son transversales: se verifican en los casos inválidos de PF-04, PF-06, PF-08 y `tests/test_permissions.py`.
- **Pendiente de registrar:** la entrevista con el docente (que fundamenta los requisitos) y la confirmación de
  los supuestos de negocio, descritos en [`requisitos.md`](requisitos.md#1-registro-de-entrevista).
