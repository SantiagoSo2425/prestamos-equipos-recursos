# Análisis de requisitos

Sistema de gestión de préstamos de equipos y recursos (PF-03). Este documento resume el alcance que se
implementa; la especificación completa con escenarios de aceptación está en
[`specs/001-prestamos-equipos/spec.md`](../specs/001-prestamos-equipos/spec.md). Equivalencia de
identificadores: `FR-0NN` (spec) = `RF-NN` (aquí).

## 1. Registro de entrevista

> **Pendiente de completar por el equipo.** La guía exige registrar la entrevista real con el docente
> (representante de la organización): preguntas, respuestas, acuerdos y cuestiones pendientes. Este
> borrador no inventa respuestas; solo deja la estructura y lista lo que debe confirmarse.

| # | Pregunta al docente | Respuesta | Acuerdo / pendiente |
|---|---|---|---|
| 1 | ¿Qué categorías de recursos se prestan y cuánto puede durar un préstamo en cada una? | _por registrar_ | Supuesto de trabajo: Portátil 72 h, Cámara 48 h, Instrumento 24 h, Otro 72 h (**sin confirmar**) |
| 2 | ¿Cuántos préstamos simultáneos puede tener un estudiante y un docente? | _por registrar_ | Supuesto: estudiante 2, docente 5 (**sin confirmar**) |
| 3 | ¿Quién aprueba las solicitudes y quién entrega/recibe los equipos? | _por registrar_ | Supuesto: un único rol RESPONSABLE |
| 4 | ¿Qué ocurre si un equipo se devuelve dañado? | _por registrar_ | Supuesto: pasa a EN_REVISION hasta que el responsable lo reactive |
| 5 | ¿Debe bloquearse a quien tiene un préstamo vencido? | _por registrar_ | Supuesto: sí, no puede hacer nuevas solicitudes |
| 6 | ¿Hay recursos exclusivos para docentes? | _por registrar_ | Supuesto: sí, marcados «solo docentes» |

## 2. Actores

| Actor | Descripción | Permisos principales |
|---|---|---|
| SOLICITANTE (estudiante o docente) | Persona que pide recursos prestados | Consultar catálogo, registrar/cancelar y ver **sus** solicitudes |
| RESPONSABLE | Encargado del inventario | Administrar recursos, aprobar/rechazar, registrar entrega y devolución, ver tablero |
| COORDINACION | Supervisión | Consulta de solo lectura (tablero e historial) |

## 3. Requisitos funcionales

| ID | Grupo | Requisito |
|---|---|---|
| RF-01 | Autenticación y permisos | El sistema debe autenticar usuarios mediante usuario y contraseña; solo usuarios autenticados acceden a la aplicación. |
| RF-02 | Autenticación y permisos | Cada usuario debe tener un rol: SOLICITANTE (con tipo ESTUDIANTE o DOCENTE), RESPONSABLE o COORDINACION; los permisos de cada operación dependen del rol. |
| RF-03 | Autenticación y permisos | Un SOLICITANTE debe ver y gestionar únicamente sus propias solicitudes y préstamos. |
| RF-04 | Autenticación y permisos | Las operaciones no autorizadas deben rechazarse sin modificar datos e informar que la acción no está permitida. |
| RF-05 | Catálogo y disponibilidad (CA-01) | El sistema debe mostrar el catálogo de recursos con código, nombre, categoría, descripción, estado operativo y restricción "solo docentes". |
| RF-06 | Catálogo y disponibilidad (CA-01) | El sistema debe permitir filtrar el catálogo por categoría, texto y rango de fecha/hora, indicando para cada recurso si está disponible en ese rango. |
| RF-07 | Catálogo y disponibilidad (CA-01) | Un recurso está disponible en un rango si su estado operativo es ACTIVO y no existe una solicitud APROBADA ni un préstamo ACTIVO/VENCIDO del mismo recurso cuyo periodo se solape. |
| RF-08 | Catálogo y disponibilidad (CA-01) | La consulta de un recurso inexistente debe devolver un error controlado de "no encontrado". |
| RF-09 | Solicitudes (CA-02) | Un SOLICITANTE debe poder registrar una solicitud con recurso, fecha/hora de inicio, fecha/hora de fin prevista y propósito académico (texto obligatorio, 10–500 caracteres). |
| RF-10 | Solicitudes (CA-02) | El sistema debe rechazar solicitudes con inicio en el pasado, fin menor o igual al inicio, o duración superior al máximo de la categoría del recurso. |
| RF-11 | Solicitudes (CA-02) | El sistema debe rechazar solicitudes sobre recursos EN_REVISION o DADO_DE_BAJA. |
| RF-12 | Solicitudes (CA-02) | El sistema debe rechazar solicitudes de estudiantes sobre recursos "solo docentes". |
| RF-13 | Solicitudes (CA-02) | El sistema debe rechazar nuevas solicitudes de un solicitante que tenga algún préstamo VENCIDO. |
| RF-14 | Solicitudes (CA-02) | El sistema debe rechazar nuevas solicitudes si el solicitante alcanzó su límite de operaciones APROBADAS + ACTIVAS (estudiante: 2; docente: 5). |
| RF-15 | Solicitudes (CA-02) | El sistema debe rechazar una solicitud cuyo periodo se solape con una solicitud APROBADA o un préstamo ACTIVO/VENCIDO del mismo recurso. |
| RF-16 | Solicitudes (CA-02) | Las solicitudes válidas deben almacenarse en estado PENDIENTE y ser recuperables por su solicitante, por el responsable y por coordinación. |
| RF-17 | Solicitudes (CA-02) | El solicitante debe poder cancelar su solicitud mientras esté PENDIENTE o APROBADA sin entregar. |
| RF-18 | Evaluación (CA-03) | Solo el RESPONSABLE debe poder aprobar o rechazar solicitudes PENDIENTES. |
| RF-19 | Evaluación (CA-03) | El rechazo debe incluir un motivo obligatorio visible para el solicitante. |
| RF-20 | Evaluación (CA-03) | Al aprobar, el sistema debe verificar de nuevo disponibilidad, estado del recurso y reglas del solicitante; si hay conflicto, la aprobación se rechaza y la solicitud sigue PENDIENTE. |
| RF-21 | Evaluación (CA-03) | La verificación de solapamiento al aprobar y entregar debe ser consistente ante operaciones simultáneas: nunca pueden quedar dos operaciones APROBADAS/ACTIVAS solapadas del mismo recurso. |
| RF-22 | Entrega y préstamo (CA-04) | Solo el RESPONSABLE debe poder registrar la entrega de una solicitud APROBADA, indicando fecha/hora real de entrega y condición de salida; la operación pasa a ACTIVA. |
| RF-23 | Entrega y préstamo (CA-04) | El sistema debe rechazar la entrega si la solicitud no está APROBADA, si el recurso no está ACTIVO o si el recurso tiene otro préstamo ACTIVO/VENCIDO. |
| RF-24 | Entrega y préstamo (CA-04) | Un préstamo ACTIVO cuya fecha de fin prevista ya pasó debe mostrarse como VENCIDO en todas las consultas. |
| RF-25 | Entrega y préstamo (CA-04) | Cada préstamo debe identificar recurso, solicitante, responsable que aprobó, responsable que entregó y, al cerrarse, responsable que recibió. |
| RF-26 | Devolución e historial (CA-05) | Solo el RESPONSABLE debe poder registrar la devolución de un préstamo ACTIVO o VENCIDO con fecha/hora real, condición (BUENO o CON_DANO) y observaciones (obligatorias si CON_DANO). |
| RF-27 | Devolución e historial (CA-05) | La devolución debe dejar el préstamo DEVUELTO, conservar todos sus datos y marcar si fue tardía. |
| RF-28 | Devolución e historial (CA-05) | Si la condición es CON_DANO, el recurso debe pasar a EN_REVISION. |
| RF-29 | Devolución e historial (CA-05) | Cada cambio de estado debe registrarse en un historial de movimientos con usuario, fecha/hora, estado anterior, estado nuevo y observación; los movimientos no se modifican ni borran. |
| RF-30 | Devolución e historial (CA-05) | El sistema debe permitir consultar el historial de préstamos (filtrado por permisos) y el historial de movimientos de cada operación. |
| RF-31 | Consulta consolidada (CA-06) | COORDINACION y RESPONSABLE deben poder ver un tablero con totales por estado, préstamos activos y vencidos con responsables, uso por recurso/categoría y estado del inventario. |
| RF-32 | Consulta consolidada (CA-06) | El historial consolidado debe poder filtrarse por rango de fechas, estado, categoría, recurso y solicitante. |
| RF-33 | Consulta consolidada (CA-06) | COORDINACION debe tener acceso de solo lectura. |
| RF-34 | Administración de recursos | Solo el RESPONSABLE debe poder registrar y editar recursos; el código de inventario debe ser único. |
| RF-35 | Administración de recursos | Un recurso con préstamo ACTIVO/VENCIDO no debe darse de baja ni pasarse a EN_REVISION hasta su devolución. |
| RF-36 | Administración de recursos | Los recursos con historial no deben eliminarse; se dan de baja (DADO_DE_BAJA). |
| RF-37 | Validación y errores | Todas las reglas deben aplicarse en el servidor aunque la petición no provenga de la interfaz; la interfaz además valida y muestra los errores por campo. |
| RF-38 | Validación y errores | Los mensajes de error deben ser comprensibles y no revelar información interna. |

## 4. Requisitos no funcionales

| ID | Categoría | Requisito |
|---|---|---|
| RNF-01 | Seguridad | Contraseñas con hash bcrypt, sesión por JWT con expiración, permisos validados en el servidor por rol y por propiedad del recurso (RF-01…RF-04, RF-37) |
| RNF-02 | Seguridad | Sin secretos en el repositorio (`.env` ignorado, `.env.example` sin valores reales); errores 500 sin trazas |
| RNF-03 | Integridad | La incompatibilidad de asignaciones se garantiza en la base de datos (restricción de exclusión de rangos) además de en el servicio |
| RNF-04 | Rendimiento | Catálogo y tablero responden en menos de 2 s con 200 recursos y 2.000 operaciones (SC-008) |
| RNF-05 | Usabilidad | Errores por campo en español, estados de carga/vacío/error, diseño adaptable básico a móvil |
| RNF-06 | Trazabilidad | Historial inmutable de movimientos; matriz criterio → requisito → código → PR → prueba |
| RNF-07 | Portabilidad | Ejecución local sin Docker obligatorio ni servicios en la nube |

## 5. Historias de usuario

| ID | Historia | Prioridad | Criterio de la guía |
|---|---|---|---|
| US1 | Consultar catálogo y disponibilidad | P1 | CA-01 |
| US2 | Registrar solicitud de préstamo | P1 | CA-02 |
| US3 | Evaluar solicitudes | P1 | CA-03 |
| US4 | Registrar entrega y préstamo activo | P1 | CA-04 |
| US5 | Registrar devolución e historial | P1 | CA-05 |
| US6 | Consulta consolidada para coordinación | P2 | CA-06 |
| US7 | Administrar el catálogo de recursos | P2 | — |

Los escenarios *Given/When/Then* de cada historia están en la spec.

## 6. Criterios de aceptación y medidas de éxito

| ID | Criterio |
|---|---|
| SC-001 | Un solicitante puede encontrar un recurso disponible y registrar una solicitud en menos de 2 minutos. |
| SC-002 | El ciclo completo (solicitud → aprobación → entrega → devolución) puede demostrarse desde la interfaz en menos de 5 minutos, y cada paso queda reflejado en los datos almacenados. |
| SC-003 | En el 100 % de los intentos de asignación incompatible (solapamiento, recurso no activo, límite, vencido, solo docentes) la operación se rechaza y la disponibilidad no cambia. |
| SC-004 | En el 100 % de las acciones no autorizadas por rol la operación se impide sin cambios en los datos. |
| SC-005 | La disponibilidad mostrada en el catálogo coincide con las asignaciones registradas en el 100 % de los casos de prueba. |
| SC-006 | Los totales del tablero de coordinación coinciden con el conteo real de registros. |
| SC-007 | Las 12 pruebas funcionales mínimas de la guía se ejecutan y quedan documentadas como aprobadas con evidencias reproducibles. |
| SC-008 | Las consultas de catálogo y tablero responden en menos de 2 segundos con al menos 200 recursos y 2.000 operaciones de datos de prueba. |

## 7. Priorización

- **P1 (núcleo del ciclo)**: US1–US5, CA-01…CA-05.
- **P2**: US6 tablero (CA-06) y US7 administración de recursos.

## 8. Supuestos sin confirmar y fuera de alcance

Supuestos pendientes de validar con el docente: duraciones máximas por categoría, límites 2/5 de
préstamos simultáneos y reglas de daño/vencido. Fuera de alcance: QR/RFID, notificaciones por
correo/WhatsApp, sanciones económicas, integración con inventarios externos, mantenimiento físico,
recuperación de contraseña y gestión de usuarios desde la interfaz.
