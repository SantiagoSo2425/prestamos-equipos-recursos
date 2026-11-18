# Guion de sustentación

Guía para la defensa (Actividad 7): ciclo completo, decisiones de diseño, pruebas a repetir y aportes por
integrante. Duración sugerida: 15 a 20 minutos más preguntas.

## 1. Antes de empezar (5 min)

- Base de datos y aplicación en marcha, ya sea en local (README §5) o en Azure:
  interfaz <https://salmon-meadow-079001f10.6.azurestaticapps.net>, API <https://app-prestamos-80585.azurewebsites.net/docs>.
- Datos de prueba cargados con `python -m app.seed` (usuarios ficticios y sus contraseñas en el README, §5).
- Cinco sesiones listas en ventanas separadas: `est.ana` (solicitante), `doc.maria` (docente), `resp.carlos`
  (responsable), `coord.sofia` (coordinación).

## 2. Ciclo completo a demostrar (≈ 8 min)

| Paso | Quién | Acción | Qué mostrar | Condición |
|---|---|---|---|---|
| 1 | `est.ana` | Abrir el catálogo, filtrar por categoría y fechas | Disponibilidad coherente con las reservas | CA-01 |
| 2 | `est.ana` | Crear una solicitud válida | Queda `PENDIENTE` en «Mis solicitudes» | CA-02 |
| 3 | `est.ana` | Repetir con datos inválidos (fin anterior al inicio, propósito corto) | Errores por campo y nada persistido | CA-02 |
| 4 | `resp.carlos` | Aprobar la solicitud en «Gestión» | Pasa a `APROBADA`, queda el movimiento | CA-03 |
| 5 | `doc.maria` | Pedir el mismo recurso en el mismo horario | Rechazo por solape (`OVERLAP`) | CA-04 |
| 6 | `resp.carlos` | Registrar la entrega | Pasa a `ACTIVA`, recurso no disponible | CA-04 |
| 7 | `resp.carlos` | Registrar la devolución (condición BUENO) | `DEVUELTA`, recurso otra vez disponible | CA-05 |
| 8 | `est.ana` | Abrir el detalle del préstamo | Historial con 4 movimientos | CA-05 |
| 9 | `coord.sofia` | Abrir tablero e historial | Totales coherentes, solo lectura | CA-06 |

Si algo falla en vivo: mostrar la evidencia equivalente en [`../evidencias/PF-12/`](../evidencias/PF-12) y la
colección [`pruebas/prestamos.http`](pruebas/prestamos.http).

## 3. Decisiones de diseño a explicar (≈ 3 min)

1. **No reservar dos veces el mismo recurso.** Dos defensas: bloqueo de filas (`SELECT … FOR UPDATE`) al aprobar y
   entregar, y una restricción en la base de datos (`EXCLUDE USING gist`, `loans_no_overlap`) que impide el solape
   aunque falle la aplicación. → [`diseno.md`](diseno.md)
2. **Un solo registro de préstamo** recorre todo el ciclo; `VENCIDA` no se guarda, se calcula.
3. **Reglas en el servidor** (RF-37); la interfaz solo ayuda a mostrar los errores por campo.
4. **Permisos por rol y por propiedad:** el solicitante solo ve lo suyo; coordinación es de solo lectura.
5. **Historial inmutable:** cada cambio de estado deja un movimiento que no se edita ni se borra.

## 4. Pruebas que conviene repetir (≈ 3 min)

Elegir tres y ejecutarlas con la interfaz de documentación (`/docs`) o con `prestamos.http`:

| Prueba | Por qué | Resultado esperado |
|---|---|---|
| [PF-08](pruebas/PF-05-a-PF-10.md) | Muestra la regla de no solape | `409` y disponibilidad intacta |
| [PF-06](pruebas/PF-05-a-PF-10.md) | Muestra los permisos | `403` y ningún cambio en los datos |
| [PF-04](pruebas/PF-04.md) | Muestra la validación | `422` o `409` sin registro nuevo |

Todas las pruebas están en [`pruebas.md`](pruebas.md) y la trazabilidad en [`trazabilidad.md`](trazabilidad.md).

## 5. Aportes por integrante (para la pregunta individual)

Cada integrante debe poder explicar su parte sin ayuda. Verificable con `git log --author` y los PR.

| Integrante | Qué hizo | Dónde verlo |
|---|---|---|
| **Santiago Suárez** (`@SantiagoSo2425`) | Especificación y plan; autenticación y roles; catálogo, solicitudes, administración de recursos y tablero (API e interfaz); verificación en PostgreSQL; despliegue en Azure; rediseño de la interfaz; documentación y sustentación | PR [#1](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/1), [#2](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/2), [#3](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/3), [#5](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/5), [#7](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/7), [#8](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/8) |
| **Juan Carlos Monsalve** (`@JuanMR1017`) | Modelo de datos, migración y semilla; reglas de negocio y concurrencia; aprobar, entregar y devolver; layout y componentes compartidos; pruebas PF-05 a PF-10; 102 pruebas automatizadas y CI | PR [#4](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/4), [#6](https://github.com/SantiagoSo2425/prestamos-equipos-recursos/pull/6); rama `feature/JuanCarlos` |

Preguntas probables y por dónde responderlas:

- *¿Cómo evitan que dos personas reserven lo mismo a la vez?* → sección 3, punto 1 y `services/rules.py`.
- *¿Qué pasa si un equipo vuelve dañado?* → pasa a `EN_REVISION` (RF-28).
- *¿De dónde salen los límites de 2 y 5 préstamos y las duraciones?* → son supuestos de trabajo; la entrevista
  con el docente no está registrada (ver [`requisitos.md`](requisitos.md#1-registro-de-entrevista)).
- *¿Qué no cubre el sistema?* → notificaciones, sanciones, QR/RFID e inventarios externos (límites de la guía).
