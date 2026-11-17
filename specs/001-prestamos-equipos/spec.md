# Feature Specification: Gestión de préstamos de equipos y recursos

**Feature Branch**: `001-prestamos-equipos`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Sistema web de gestión de préstamos de equipos y recursos para una institución educativa (guía PF-03). Actores: SOLICITANTE (estudiante o docente), RESPONSABLE de préstamos, COORDINACION. Recursos como unidades individuales; disponibilidad por rango de fecha/hora; ciclo PENDIENTE → APROBADA/RECHAZADA → ENTREGADA/ACTIVA → (VENCIDA) → DEVUELTA, con cancelación; reglas de solapamiento, límites por rol, bloqueo por vencidos, recursos solo docentes, estado al devolver; historial de movimientos; consulta consolidada para coordinación. Debe cumplir CA-01 a CA-06."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar catálogo y disponibilidad (Priority: P1) — CA-01

Un usuario autenticado (cualquier rol) consulta el catálogo de recursos de la institución, filtra por
categoría y por un rango de fecha/hora, y ve para cada recurso si está disponible en ese rango, su
estado operativo y, si no lo está, por qué (prestado, reservado, en revisión).

**Why this priority**: Es la puerta de entrada al proceso; sin conocer la disponibilidad no hay
solicitud. Es el primer valor demostrable (CA-01, prueba mínima 1 y 2).

**Independent Test**: Con recursos y préstamos de datos semilla, iniciar sesión, filtrar por
categoría y rango, y comprobar que la disponibilidad mostrada coincide con los préstamos registrados.

**Acceptance Scenarios**:

1. **Given** recursos registrados y un préstamo ACTIVO sobre PORT-001 de lunes 8:00 a miércoles
   18:00, **When** el usuario consulta portátiles para el martes, **Then** PORT-001 aparece como
   no disponible y los demás portátiles ACTIVO sin reservas aparecen disponibles.
2. **Given** un recurso EN_REVISION, **When** se consulta el catálogo, **Then** el recurso aparece
   como no solicitable con su estado visible.
3. **Given** un código de recurso inexistente, **When** se consulta su detalle, **Then** el sistema
   responde con un mensaje de "recurso no encontrado" sin errores internos.
4. **Given** un visitante sin sesión, **When** intenta consultar el catálogo, **Then** se le exige
   iniciar sesión.

---

### User Story 2 - Registrar solicitud de préstamo (Priority: P1) — CA-02

Un solicitante (estudiante o docente) elige una unidad concreta, indica fecha/hora de inicio, fecha/hora
de fin prevista y el propósito académico, y registra la solicitud. La solicitud queda en estado
PENDIENTE, la puede consultar después en "Mis solicitudes" y puede cancelarla mientras no haya sido
entregada.

**Why this priority**: Es el núcleo del proceso y la condición CA-02 (pruebas mínimas 3 y 4).

**Independent Test**: Iniciar sesión como estudiante, registrar una solicitud válida, cerrar sesión,
volver a entrar y verla en "Mis solicitudes" con estado PENDIENTE; intentar solicitudes inválidas y
verificar que no se almacenan.

**Acceptance Scenarios**:

1. **Given** un estudiante sin préstamos y un recurso ACTIVO disponible, **When** registra una
   solicitud válida para mañana de 8:00 a 12:00, **Then** la solicitud se guarda como PENDIENTE y
   aparece en su lista.
2. **Given** un formulario con fin anterior al inicio, fecha en el pasado, propósito vacío o duración
   mayor al máximo de la categoría, **When** se envía, **Then** se rechaza con mensajes claros por campo
   y no se almacena nada.
3. **Given** un recurso marcado "solo docentes", **When** un estudiante intenta solicitarlo, **Then**
   la solicitud se rechaza indicando la restricción.
4. **Given** un solicitante con un préstamo VENCIDO, **When** intenta registrar una nueva solicitud,
   **Then** se rechaza indicando que debe devolver primero el recurso vencido.
5. **Given** un estudiante con 2 préstamos entre APROBADOS y ACTIVOS, **When** intenta una tercera
   solicitud, **Then** se rechaza por límite de préstamos.
6. **Given** una solicitud propia en PENDIENTE o APROBADA sin entregar, **When** el solicitante la
   cancela, **Then** pasa a CANCELADA y el periodo queda liberado.
7. **Given** un solicitante, **When** intenta ver una solicitud de otra persona, **Then** el sistema
   lo impide.

---

### User Story 3 - Evaluar solicitudes (Priority: P1) — CA-03

El responsable de préstamos ve la bandeja de solicitudes PENDIENTES, revisa el detalle (solicitante,
recurso, periodo, propósito, conflictos) y decide aprobar o rechazar. El rechazo exige un motivo. La
aprobación vuelve a verificar que no haya solapamiento con otras solicitudes APROBADAS o préstamos
ACTIVOS del mismo recurso.

**Why this priority**: Sin evaluación el ciclo no avanza; CA-03 y pruebas 5 y 6.

**Independent Test**: Con solicitudes PENDIENTES semilla, entrar como responsable, aprobar una y
rechazar otra con motivo; entrar como estudiante e intentar aprobar y comprobar que se impide.

**Acceptance Scenarios**:

1. **Given** una solicitud PENDIENTE sin conflictos, **When** el responsable la aprueba, **Then**
   queda APROBADA, el periodo queda reservado y se registra el movimiento con usuario y fecha.
2. **Given** una solicitud PENDIENTE, **When** el responsable la rechaza sin motivo, **Then** se pide
   el motivo y la solicitud no cambia; con motivo, queda RECHAZADA y el motivo es visible al solicitante.
3. **Given** dos solicitudes PENDIENTES del mismo recurso con periodos que se solapan, **When** el
   responsable aprueba la primera y luego intenta aprobar la segunda, **Then** la segunda se rechaza
   por conflicto y permanece PENDIENTE.
4. **Given** un usuario SOLICITANTE o COORDINACION, **When** intenta aprobar o rechazar, **Then** la
   operación se impide y nada cambia.
5. **Given** una solicitud ya RECHAZADA o CANCELADA, **When** se intenta aprobar, **Then** se rechaza
   por transición de estado inválida.

---

### User Story 4 - Registrar entrega y préstamo activo (Priority: P1) — CA-04

Cuando el solicitante recoge el recurso, el responsable registra la entrega de una solicitud APROBADA:
fecha/hora real de entrega y condición de salida. La operación pasa a ACTIVA (préstamo en curso),
identificando recurso, solicitante y responsable que entregó. Si se supera la fecha de fin sin
devolución, el préstamo se muestra como VENCIDO.

**Why this priority**: CA-04, pruebas 7, 8 y 9; sin esto no hay préstamo real.

**Independent Test**: Aprobar una solicitud, registrar su entrega y consultar el préstamo activo con
recurso, solicitante y responsable correctos; intentar entregar una solicitud no aprobada o
un recurso no disponible y comprobar el rechazo.

**Acceptance Scenarios**:

1. **Given** una solicitud APROBADA, **When** el responsable registra la entrega, **Then** queda
   ACTIVA con fecha real, condición de salida y responsable de entrega, y el recurso figura como
   prestado.
2. **Given** una solicitud PENDIENTE, RECHAZADA o CANCELADA, **When** se intenta registrar la entrega,
   **Then** se rechaza y el estado no cambia.
3. **Given** un recurso con un préstamo ACTIVO, **When** se intenta entregar otra solicitud del mismo
   recurso cuyo periodo se solapa, **Then** la operación se rechaza y la disponibilidad se conserva.
4. **Given** un recurso que pasó a EN_REVISION después de aprobada la solicitud, **When** se intenta
   entregar, **Then** se rechaza indicando el estado del recurso.
5. **Given** un préstamo ACTIVO cuya fecha de fin ya pasó, **When** se consulta, **Then** aparece como
   VENCIDO con el solicitante responsable visible.

---

### User Story 5 - Registrar devolución e historial (Priority: P1) — CA-05

El responsable registra la devolución de un préstamo ACTIVO o VENCIDO: fecha/hora real, condición
(BUENO o CON_DANO) y observaciones. El préstamo queda DEVUELTO; si la condición es CON_DANO, el
recurso pasa a EN_REVISION y deja de ser solicitable. Cualquier usuario autorizado consulta el
historial de préstamos (el solicitante solo el suyo) y el historial de movimientos de cada operación.

**Why this priority**: Cierra el ciclo; CA-05 y prueba 10.

**Independent Test**: Registrar la devolución de un préstamo activo y verificar que el recurso
vuelve a figurar disponible y que el historial muestra todos los movimientos con fechas y usuarios.

**Acceptance Scenarios**:

1. **Given** un préstamo ACTIVO, **When** se registra la devolución en condición BUENO, **Then**
   queda DEVUELTO, se conservan todos sus datos y el recurso vuelve a estar disponible.
2. **Given** un préstamo VENCIDO, **When** se registra la devolución, **Then** queda DEVUELTO con
   indicación de devolución tardía y el solicitante deja de estar bloqueado.
3. **Given** una devolución CON_DANO, **When** se registra, **Then** el recurso pasa a EN_REVISION
   y no aparece disponible en el catálogo hasta que el responsable lo reactive.
4. **Given** un préstamo ya DEVUELTO o una solicitud no entregada, **When** se intenta registrar la
   devolución, **Then** se rechaza.
5. **Given** un préstamo cerrado, **When** se consulta su historial, **Then** se ven en orden los
   movimientos (creación, aprobación, entrega, devolución) con usuario, fecha y observaciones.

---

### User Story 6 - Consulta consolidada para coordinación (Priority: P2) — CA-06

Coordinación accede a un tablero de solo lectura con: totales de solicitudes/préstamos por estado,
lista de préstamos activos y vencidos con solicitante y responsable, uso por recurso y por categoría,
estado operativo de los recursos y un historial filtrable por fechas, estado, categoría y solicitante.

**Why this priority**: CA-06 y prueba 11; depende de que existan datos del ciclo.

**Independent Test**: Con datos semilla que incluyen varios recursos y préstamos en distintos
estados, entrar como coordinación y comprobar que los totales coinciden con los registros.

**Acceptance Scenarios**:

1. **Given** préstamos en distintos estados, **When** coordinación abre el tablero, **Then** los
   totales por estado coinciden con los registros existentes.
2. **Given** préstamos vencidos, **When** se consulta, **Then** se listan con recurso, solicitante,
   fecha de fin prevista y días de retraso.
3. **Given** el historial, **When** coordinación filtra por categoría y rango de fechas, **Then** solo
   se muestran las operaciones que cumplen el filtro.
4. **Given** coordinación, **When** intenta aprobar, entregar o editar un recurso, **Then** la
   operación se impide.

---

### User Story 7 - Administrar el catálogo de recursos (Priority: P2)

El responsable registra nuevos recursos (código de inventario único, nombre, categoría, descripción,
"solo docentes") y edita sus datos y estado operativo (ACTIVO, EN_REVISION, DADO_DE_BAJA). Los
recursos no se eliminan físicamente si tienen préstamos; se dan de baja.

**Why this priority**: Necesario para operar, pero el MVP puede funcionar con datos semilla.

**Independent Test**: Crear un recurso, verlo en el catálogo, cambiarlo a EN_REVISION y ver que deja
de ser solicitable; intentar un código duplicado y comprobar el rechazo.

**Acceptance Scenarios**:

1. **Given** el responsable, **When** registra un recurso con código nuevo y datos válidos, **Then**
   aparece en el catálogo como ACTIVO.
2. **Given** un código ya existente, **When** se intenta registrar, **Then** se rechaza por duplicado.
3. **Given** un recurso con préstamo ACTIVO, **When** se intenta dar de baja, **Then** se rechaza
   hasta que se devuelva.
4. **Given** un recurso EN_REVISION, **When** el responsable lo cambia a ACTIVO, **Then** vuelve a ser
   solicitable.
5. **Given** un solicitante, **When** intenta crear o editar recursos, **Then** se impide.

---

### Edge Cases

- Dos solicitudes para el mismo recurso y periodo solapado se aprueban casi al mismo tiempo: solo una
  debe quedar APROBADA; la otra recibe error de conflicto.
- Periodos contiguos (uno termina a las 10:00 y otro empieza a las 10:00) no se consideran solapados.
- Una solicitud PENDIENTE cuyo inicio ya pasó sin evaluarse no puede aprobarse; el responsable solo
  puede rechazarla.
- Un recurso que pasa a EN_REVISION o DADO_DE_BAJA con solicitudes APROBADAS futuras: estas no pueden
  entregarse; el responsable debe rechazarlas/cancelarlas.
- Solicitudes PENDIENTES no reservan el recurso: varias pueden coexistir para el mismo periodo hasta
  que una sea aprobada.
- Entrega registrada antes de la hora de inicio aprobada: se permite si no hay préstamo activo del
  recurso en ese momento.
- Sesión expirada durante una operación: el usuario debe volver a autenticarse sin pérdida de datos
  persistidos.
- Datos con formato incorrecto enviados directamente al servicio, sin pasar por la interfaz: se
  rechazan igual que desde la interfaz.

## Requirements *(mandatory)*

### Functional Requirements

**Autenticación y permisos**

- **FR-001**: El sistema MUST autenticar usuarios mediante usuario y contraseña; solo usuarios
  autenticados acceden a la aplicación.
- **FR-002**: Cada usuario MUST tener un rol: SOLICITANTE (con tipo ESTUDIANTE o DOCENTE),
  RESPONSABLE o COORDINACION; los permisos de cada operación dependen del rol.
- **FR-003**: Un SOLICITANTE MUST ver y gestionar únicamente sus propias solicitudes y préstamos.
- **FR-004**: Las operaciones no autorizadas MUST rechazarse sin modificar datos e informar que la
  acción no está permitida.

**Catálogo y disponibilidad (CA-01)**

- **FR-005**: El sistema MUST mostrar el catálogo de recursos con código, nombre, categoría,
  descripción, estado operativo y restricción "solo docentes".
- **FR-006**: El sistema MUST permitir filtrar el catálogo por categoría, texto y rango de fecha/hora,
  indicando para cada recurso si está disponible en ese rango.
- **FR-007**: Un recurso está disponible en un rango si su estado operativo es ACTIVO y no existe una
  solicitud APROBADA ni un préstamo ACTIVO/VENCIDO del mismo recurso cuyo periodo se solape.
- **FR-008**: La consulta de un recurso inexistente MUST devolver un error controlado de "no
  encontrado".

**Solicitudes (CA-02)**

- **FR-009**: Un SOLICITANTE MUST poder registrar una solicitud con recurso, fecha/hora de inicio,
  fecha/hora de fin prevista y propósito académico (texto obligatorio, 10–500 caracteres).
- **FR-010**: El sistema MUST rechazar solicitudes con inicio en el pasado, fin menor o igual al
  inicio, o duración superior al máximo de la categoría del recurso.
- **FR-011**: El sistema MUST rechazar solicitudes sobre recursos EN_REVISION o DADO_DE_BAJA.
- **FR-012**: El sistema MUST rechazar solicitudes de estudiantes sobre recursos "solo docentes".
- **FR-013**: El sistema MUST rechazar nuevas solicitudes de un solicitante que tenga algún préstamo
  VENCIDO.
- **FR-014**: El sistema MUST rechazar nuevas solicitudes si el solicitante alcanzó su límite de
  operaciones APROBADAS + ACTIVAS (estudiante: 2; docente: 5).
- **FR-015**: El sistema MUST rechazar una solicitud cuyo periodo se solape con una solicitud APROBADA
  o un préstamo ACTIVO/VENCIDO del mismo recurso.
- **FR-016**: Las solicitudes válidas MUST almacenarse en estado PENDIENTE y ser recuperables por su
  solicitante, por el responsable y por coordinación.
- **FR-017**: El solicitante MUST poder cancelar su solicitud mientras esté PENDIENTE o APROBADA sin
  entregar.

**Evaluación (CA-03)**

- **FR-018**: Solo el RESPONSABLE MUST poder aprobar o rechazar solicitudes PENDIENTES.
- **FR-019**: El rechazo MUST incluir un motivo obligatorio visible para el solicitante.
- **FR-020**: Al aprobar, el sistema MUST verificar de nuevo disponibilidad, estado del recurso y
  reglas del solicitante; si hay conflicto, la aprobación se rechaza y la solicitud sigue PENDIENTE.
- **FR-021**: La verificación de solapamiento al aprobar y entregar MUST ser consistente ante
  operaciones simultáneas: nunca pueden quedar dos operaciones APROBADAS/ACTIVAS solapadas del mismo
  recurso.

**Entrega y préstamo (CA-04)**

- **FR-022**: Solo el RESPONSABLE MUST poder registrar la entrega de una solicitud APROBADA,
  indicando fecha/hora real de entrega y condición de salida; la operación pasa a ACTIVA.
- **FR-023**: El sistema MUST rechazar la entrega si la solicitud no está APROBADA, si el recurso no
  está ACTIVO o si el recurso tiene otro préstamo ACTIVO/VENCIDO.
- **FR-024**: Un préstamo ACTIVO cuya fecha de fin prevista ya pasó MUST mostrarse como VENCIDO en
  todas las consultas.
- **FR-025**: Cada préstamo MUST identificar recurso, solicitante, responsable que aprobó,
  responsable que entregó y, al cerrarse, responsable que recibió.

**Devolución e historial (CA-05)**

- **FR-026**: Solo el RESPONSABLE MUST poder registrar la devolución de un préstamo ACTIVO o VENCIDO
  con fecha/hora real, condición (BUENO o CON_DANO) y observaciones (obligatorias si CON_DANO).
- **FR-027**: La devolución MUST dejar el préstamo DEVUELTO, conservar todos sus datos y marcar si
  fue tardía.
- **FR-028**: Si la condición es CON_DANO, el recurso MUST pasar a EN_REVISION.
- **FR-029**: Cada cambio de estado MUST registrarse en un historial de movimientos con usuario,
  fecha/hora, estado anterior, estado nuevo y observación; los movimientos no se modifican ni borran.
- **FR-030**: El sistema MUST permitir consultar el historial de préstamos (filtrado por permisos) y
  el historial de movimientos de cada operación.

**Consulta consolidada (CA-06)**

- **FR-031**: COORDINACION y RESPONSABLE MUST poder ver un tablero con totales por estado,
  préstamos activos y vencidos con responsables, uso por recurso/categoría y estado del inventario.
- **FR-032**: El historial consolidado MUST poder filtrarse por rango de fechas, estado, categoría,
  recurso y solicitante.
- **FR-033**: COORDINACION MUST tener acceso de solo lectura.

**Administración de recursos**

- **FR-034**: Solo el RESPONSABLE MUST poder registrar y editar recursos; el código de inventario MUST
  ser único.
- **FR-035**: Un recurso con préstamo ACTIVO/VENCIDO MUST NOT darse de baja ni pasarse a EN_REVISION
  hasta su devolución.
- **FR-036**: Los recursos con historial MUST NOT eliminarse; se dan de baja (DADO_DE_BAJA).

**Validación y errores**

- **FR-037**: Todas las reglas MUST aplicarse en el servidor aunque la petición no provenga de la
  interfaz; la interfaz además valida y muestra los errores por campo.
- **FR-038**: Los mensajes de error MUST ser comprensibles y no revelar información interna.

### Key Entities *(include if feature involves data)*

- **Usuario**: persona que usa el sistema; nombre, usuario de acceso, credencial protegida, rol,
  tipo de solicitante (estudiante/docente, solo si es SOLICITANTE), identificación institucional
  ficticia, activo/inactivo.
- **Categoría**: tipo de recurso (Portátil, Cámara, Instrumento, Otro) con duración máxima de
  préstamo.
- **Recurso**: unidad física prestable; código de inventario único, nombre, descripción, categoría,
  estado operativo, "solo docentes". Pertenece a una categoría; tiene muchas solicitudes.
- **Solicitud/Préstamo**: operación única que recorre el ciclo; solicitante, recurso, inicio y fin
  previstos, propósito, estado (PENDIENTE, APROBADA, RECHAZADA, CANCELADA, ACTIVA, DEVUELTA; VENCIDA
  es la vista de una ACTIVA con fin superado), motivo de rechazo, responsables de aprobación/entrega/
  recepción, fechas reales de entrega y devolución, condiciones de salida y devolución, observaciones.
- **Movimiento**: registro inmutable de cada cambio de estado de una solicitud; operación, usuario,
  fecha/hora, estado anterior, estado nuevo, observación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un solicitante puede encontrar un recurso disponible y registrar una solicitud en menos
  de 2 minutos.
- **SC-002**: El ciclo completo (solicitud → aprobación → entrega → devolución) puede demostrarse
  desde la interfaz en menos de 5 minutos, y cada paso queda reflejado en los datos almacenados.
- **SC-003**: En el 100 % de los intentos de asignación incompatible (solapamiento, recurso no
  activo, límite, vencido, solo docentes) la operación se rechaza y la disponibilidad no cambia.
- **SC-004**: En el 100 % de las acciones no autorizadas por rol la operación se impide sin cambios
  en los datos.
- **SC-005**: La disponibilidad mostrada en el catálogo coincide con las asignaciones registradas en
  el 100 % de los casos de prueba.
- **SC-006**: Los totales del tablero de coordinación coinciden con el conteo real de registros.
- **SC-007**: Las 12 pruebas funcionales mínimas de la guía se ejecutan y quedan documentadas como
  aprobadas con evidencias reproducibles.
- **SC-008**: Las consultas de catálogo y tablero responden en menos de 2 segundos con al menos 200
  recursos y 2.000 operaciones de datos de prueba.

## Assumptions

- Duraciones máximas por categoría (supuesto pendiente de confirmar con el docente): Portátil 3 días,
  Cámara 2 días, Instrumento 1 día, Otro 3 días.
- Límites de operaciones simultáneas (APROBADAS + ACTIVAS): estudiante 2, docente 5 (confirmado por el
  equipo, pendiente de validación del docente).
- Las solicitudes PENDIENTES no bloquean la disponibilidad; solo las APROBADAS y los préstamos
  ACTIVOS/VENCIDOS.
- No hay registro público: los usuarios se cargan con datos semilla ficticios; la gestión de usuarios
  desde la interfaz queda fuera del alcance.
- El estado VENCIDO se calcula al consultar a partir de la fecha de fin prevista; no requiere procesos
  programados.
- Una solicitud corresponde a una sola unidad de recurso; pedir varias unidades requiere varias
  solicitudes.
- Zona horaria única de la institución (America/Bogota).
- Fuera de alcance: QR/RFID, notificaciones por correo/WhatsApp, sanciones económicas, integración con
  inventarios externos, mantenimiento físico, recuperación de contraseña.
- Uso en navegador de escritorio; diseño adaptable básico a móvil, sin aplicación nativa.
