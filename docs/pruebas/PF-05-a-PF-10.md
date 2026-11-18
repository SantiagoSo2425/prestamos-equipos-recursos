# Pruebas funcionales de Persona B (PF-05 … PF-10)

> Estado: **ejecutadas con `backend/scripts/smoke_flow.py` contra PostgreSQL 16 + semilla; todas coinciden con lo esperado** (salida en `evidencias/PF-05-a-PF-10/salida-smoke.txt`). Faltan las capturas de pantalla de la UI.
> Usuarios de demo: `resp.carlos` (RESPONSABLE), `est.ana`, `est.luis`, `doc.maria`, `coord.sofia`.
> Los ids de préstamo se leen de `GET /api/loans` tras sembrar.

## PF-05 — Aprobación y rechazo por RESPONSABLE (RF-18/19, CA-03)

- **Precondiciones**: dos solicitudes PENDIENTE (semilla: las dos de `CAM-001`, solapadas).
- **Pasos**: login `resp.carlos` → `POST /api/loans/{A}/approve` → `POST /api/loans/{B}/reject` con `{"reason":"Recurso reservado para otra actividad"}`.
- **Esperado**: 200 con `status=APROBADA` (con `approved_by`) y 200 con `status=RECHAZADA` (con `rejection_reason`); un movimiento por operación en `loan_movements`.
- **Verificación SQL**: `SELECT loan_id, from_status, to_status, note FROM loan_movements WHERE loan_id IN (A,B) ORDER BY id;`
- **Casos de borde**: aprobar la segunda solicitud solapada → 409 `OVERLAP`; rechazar sin motivo → 422 `VALIDATION_ERROR`; aprobar una ya aprobada → 409 `INVALID_TRANSITION`.
- **Obtenido / Estado / Evidencia**: Coincide con lo esperado (ver salida del script) · `evidencias/PF-05-a-PF-10/`

## PF-06 — Acceso no autorizado a aprobar (RF-37, CA-03)

- **Pasos**: `POST /api/loans/{id}/approve` con el token de `est.ana` y luego con el de `coord.sofia`; sin token.
- **Esperado**: 403 `FORBIDDEN` (ambos roles) y 401 `NOT_AUTHENTICATED` sin token; el estado del préstamo no cambia.
- **Verificación SQL**: `SELECT status FROM loans WHERE id = {id};` igual que antes.
- **Obtenido / Estado / Evidencia**: Coincide con lo esperado (ver salida del script) · `evidencias/PF-05-a-PF-10/`

## PF-07 — Asignación de un recurso disponible (RF-22/24, CA-04)

- **Precondiciones**: préstamo APROBADA (semilla: `PORT-002` de `est.ana`).
- **Pasos**: `POST /api/loans/{id}/deliver` con `{"checkout_condition":"Completo, con cargador"}` → `GET /api/loans/{id}`.
- **Esperado**: 200, `status=ACTIVA`, `delivered_by=resp.carlos`, `delivered_at` y `checkout_condition` correctos, recurso y solicitante coherentes; movimiento APROBADA→ACTIVA.
- **Obtenido / Estado / Evidencia**: Coincide con lo esperado (ver salida del script) · `evidencias/PF-05-a-PF-10/`

## PF-08 — Entrega o aprobación incompatible (RF-23/25, CA-04)

- **Casos**: (a) entregar una PENDIENTE → 409 `INVALID_TRANSITION`; (b) aprobar una solicitud que solapa una APROBADA/ACTIVA del mismo recurso → 409 `OVERLAP`; (c) entregar un recurso que ya tiene otra ACTIVA → 409 `RESOURCE_NOT_AVAILABLE`; (d) entregar con recurso `EN_REVISION` → 409 `RESOURCE_NOT_AVAILABLE`.
- **Esperado**: en todos los casos el error indicado y **ningún cambio** en `loans` ni `resources` (comparar `SELECT id,status FROM loans` antes y después).
- **Obtenido / Estado / Evidencia**: Coincide con lo esperado (ver salida del script) · `evidencias/PF-05-a-PF-10/`

## PF-09 — Consulta de préstamo activo y vencido (RF-25/26, CA-04)

- **Precondiciones**: semilla con una ACTIVA vigente (`INST-001`) y una vencida de `est.luis` (`PORT-001`).
- **Pasos**: `GET /api/loans?status=ACTIVA` y `GET /api/loans?status=VENCIDA`; abrir `/prestamos/{id}` en la UI.
- **Esperado**: la vencida aparece solo en `VENCIDA` con `effective_status=VENCIDA` y `days_overdue ≥ 1`; la vigente solo en `ACTIVA`; responsable de entrega y recurso coherentes.
- **Obtenido / Estado / Evidencia**: Coincide con lo esperado (ver salida del script) · `evidencias/PF-05-a-PF-10/`

## PF-10 — Devolución, disponibilidad e historial (RF-27/28/29, CA-05)

- **Pasos**: (a) devolver una ACTIVA con `{"return_condition":"BUENO"}`; (b) devolver otra con `CON_DANO` sin `return_notes`; (c) repetir con notas; (d) devolver una ya DEVUELTA.
- **Esperado**: (a) 200 `DEVUELTA`, `is_late` según `end_at`, recurso de nuevo disponible; (b) 422 con campo `return_notes`; (c) 200 y recurso → `EN_REVISION`, nota en el movimiento; (d) 409 `INVALID_TRANSITION`.
- **Verificación SQL**: `SELECT status FROM resources WHERE id = …;` y `SELECT from_status,to_status,note FROM loan_movements WHERE loan_id = … ORDER BY id;` (creación→aprobación→entrega→devolución).
- **Obtenido / Estado / Evidencia**: Coincide con lo esperado (ver salida del script) · `evidencias/PF-05-a-PF-10/`
