<!--
Sync Impact Report
- Version change: template → 1.0.0 (adopción inicial)
- Principios definidos: I. Ciclo de préstamo completo; II. Integridad de datos y reglas en el servidor;
  III. Seguridad y control de acceso por rol; IV. API REST explícita y documentada;
  V. Pruebas funcionales verificables; VI. Trazabilidad y Git disciplinado; VII. Simplicidad
- Secciones añadidas: Restricciones técnicas; Flujo de desarrollo
- Secciones eliminadas: ninguna
- TODOs diferidos: ninguno
-->

# Constitución — Sistema de Préstamo de Equipos y Recursos (PF-03)

## Core Principles

### I. Ciclo de préstamo completo (NO NEGOCIABLE)

La aplicación MUST implementar el ciclo completo: consulta de disponibilidad → solicitud →
evaluación → asignación/entrega → seguimiento → devolución → historial y consulta consolidada.
Un CRUD genérico de recursos, pantallas con datos simulados o una API sin interfaz NO cumplen.
Las operaciones CRUD solo se exponen cuando el proceso lo justifica (p. ej., un préstamo nunca se
"elimina": se cierra o se cancela).

**Rationale**: Las condiciones CA-01 a CA-06 de la guía definen el producto mínimo.

### II. Integridad de datos y reglas de negocio en el servidor

Toda regla de negocio (disponibilidad, transiciones de estado, solapamiento de fechas, permisos)
MUST validarse en el backend, independientemente del frontend. Un recurso MUST NOT quedar asignado
simultáneamente a préstamos incompatibles; la verificación MUST ser atómica (transacción y/o
restricción de base de datos) para resistir solicitudes concurrentes. Los cambios de estado
MUST seguir una máquina de estados explícita y quedar registrados con usuario y fecha.

**Rationale**: La guía exige que la integridad se mantenga aunque la petición no venga de la UI.

### III. Seguridad y control de acceso por rol

La autenticación MUST usar JWT y contraseñas con hash seguro. Cada endpoint MUST declarar qué
roles (SOLICITANTE, RESPONSABLE, COORDINACION) pueden usarlo; un solicitante solo ve y modifica
sus propias solicitudes. Prohibido versionar secretos: `.env` fuera de Git y `.env.example` sin
valores reales. Datos de prueba MUST ser ficticios. Los mensajes de error MUST NOT exponer trazas,
SQL ni datos sensibles.

### IV. API REST explícita y documentada

Recursos con sustantivos en plural, métodos HTTP semánticos y códigos de estado correctos
(200, 201, 204, 400/422, 401, 403, 404, 409). Los errores MUST usar un formato JSON uniforme
(`{"detail": ..., "code": ...}`). La especificación OpenAPI generada por FastAPI (`/docs`) MUST
mantenerse coherente con `docs/diseno.md` y la tabla de endpoints del README.

### V. Pruebas funcionales verificables

Cada condición CA-XX y cada prueba mínima (1–12) de la guía MUST tener una prueba funcional
documentada con: ID, requisito, precondiciones, pasos, datos, resultado esperado/obtenido, estado,
evidencia, método y código HTTP. Las evidencias se guardan en `evidencias/`. La automatización es
opcional; si se añaden pruebas automáticas, complementan pero no sustituyen la documentación.

### VI. Trazabilidad y Git disciplinado

Todo cambio se desarrolla en una rama y se integra por pull request que documente propósito,
cambios, pruebas efectuadas y requisitos (`RF-XX`/`CA-XX`) asociados. Commits pequeños y
descriptivos (estilo Conventional Commits en español). `docs/trazabilidad.md` MUST vincular
CA → RF → implementación → PR → prueba y actualizarse con cada PR relevante.

### VII. Simplicidad

Se prefiere la solución más simple que cumpla los requisitos aprobados (YAGNI). Extensiones fuera
del alcance (QR/RFID, notificaciones, sanciones, inventarios externos) MUST NOT implementarse
antes de completar CA-01 a CA-06.

## Restricciones técnicas

- **Frontend**: React (Vite) + TypeScript, consumiendo la API real mediante HTTP.
- **Backend**: Python 3.12 + FastAPI, Pydantic para validación, SQLAlchemy 2.x + Alembic para
  persistencia y migraciones.
- **Base de datos**: PostgreSQL.
- **Ejecución local reproducible** con instrucciones en el README; no se exige Docker ni nube.
- Idioma: documentación y UI en español; identificadores de código en inglés.

## Flujo de desarrollo

1. Especificación (`/speckit-specify`, `/speckit-clarify`) → alimenta `docs/requisitos.md`.
2. Plan (`/speckit-plan`) → alimenta `docs/diseno.md` (arquitectura, modelo de datos, API).
3. Tareas (`/speckit-tasks`) → implementación incremental por historia de usuario en ramas/PR.
4. Pruebas funcionales y evidencias por cada CA antes de cerrar la feature.
5. Actualizar `docs/trazabilidad.md` y el README antes de la entrega.

## Governance

Esta constitución prevalece sobre otras prácticas del proyecto. Toda enmienda MUST documentarse
en este archivo con incremento de versión semántica (MAJOR: eliminación/redefinición de principios;
MINOR: principio o sección nueva; PATCH: aclaraciones). Cada PR MUST verificar el cumplimiento de
los principios; cualquier complejidad adicional MUST justificarse en el plan correspondiente.

**Version**: 1.0.0 | **Ratified**: 2026-11-16 | **Last Amended**: 2026-11-16
