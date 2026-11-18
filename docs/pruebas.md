# Pruebas funcionales

Índice de las pruebas funcionales documentadas (PF-01…PF-12 de la guía, más PF-13 y PF-14 adicionales).
Cada prueba vive en su propio archivo `docs/pruebas/PF-XX.md` para evitar conflictos entre integrantes;
al cierre del proyecto se unifican en este documento. Las evidencias están en `evidencias/PF-XX/` y las
peticiones reproducibles en [`pruebas/prestamos.http`](pruebas/prestamos.http).

Plantilla de cada prueba: ID · requisito · precondiciones · pasos · datos · resultado esperado ·
resultado obtenido · estado · evidencia · método/HTTP.

| ID | Prueba | Criterio | Responsable | Documento | Estado |
|---|---|---|---|---|---|
| PF-01 | Consulta de catálogo y disponibilidad | CA-01 | A | [PF-01](pruebas/PF-01.md) | ⏳ Pendiente de ejecución |
| PF-02 | Recurso inexistente → 404 | CA-01 | A | [PF-02](pruebas/PF-02.md) | ⏳ Pendiente de ejecución |
| PF-03 | Solicitud válida | CA-02 | A | [PF-03](pruebas/PF-03.md) | ⏳ Pendiente de ejecución |
| PF-04 | Solicitudes inválidas o reglas incumplidas | CA-02 | A | [PF-04](pruebas/PF-04.md) | ⏳ Pendiente de ejecución |
| PF-05 | Aprobación / rechazo por RESPONSABLE | CA-03 | B | _pendiente de B_ | — |
| PF-06 | Aprobar sin permiso → 403 | CA-03 | B | _pendiente de B_ | — |
| PF-07 | Asignación de recurso disponible | CA-04 | B | _pendiente de B_ | — |
| PF-08 | Entrega / aprobación incompatible → 409 | CA-04 | B | _pendiente de B_ | — |
| PF-09 | Consulta de préstamo activo y vencido | CA-04 | B | _pendiente de B_ | — |
| PF-10 | Devolución e historial | CA-05 | B | _pendiente de B_ | — |
| PF-11 | Consulta consolidada y consistencia | CA-06 | A | [PF-11](pruebas/PF-11.md) | ⏳ Pendiente de ejecución |
| PF-12 | Flujo integral interfaz–API–BD | CA-01…CA-06 | A + B | _cierre_ | — |
| PF-13 | Alta de recurso y duplicado (adicional) | US7 | A | [PF-13](pruebas/PF-13.md) | ⏳ Pendiente de ejecución |
| PF-14 | Cambio de estado con préstamo activo (adicional) | US7 | A | [PF-14](pruebas/PF-14.md) | ⏳ Pendiente de ejecución |

Las pruebas de A quedan en *Pendiente de ejecución* hasta que el PR de datos de Persona B (modelos,
migración y semilla) esté integrado y se pueda correr contra PostgreSQL.
