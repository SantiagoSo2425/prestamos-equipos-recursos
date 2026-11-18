# Integración continua y pruebas automatizadas

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Se ejecuta en cada *push* a `main`, `develop`,
`feature/**`, `feat/**` y `fix/**`, y en cada *pull request* hacia `main` o `develop`.

| Job | Qué hace |
|---|---|
| **Backend** | Levanta PostgreSQL 16 como servicio, verifica que `alembic upgrade head`, la semilla y `downgrade base` funcionan desde cero y ejecuta `pytest` (reporte JUnit como artefacto). |
| **Frontend** | `npm ci`, `npm run lint` (oxlint) y `npm run build` (comprobación de tipos con `tsc` y empaquetado). |

## Pruebas automatizadas (`backend/tests/`)

| Archivo | Cubre |
|---|---|
| `test_rules.py` | Reglas V1–V7 (fechas, duración máxima, recurso operativo, solo docentes, vencidos, límites 2/5, solapamiento con periodos contiguos `[)`, ACTIVA vencida con ocupación abierta), restricción `loans_no_overlap` de la BD y transiciones inválidas de la máquina de estados. |
| `test_workflow_api.py` | Ciclo aprobar → entregar → devolver con su historial, devolución con daño (recurso → `EN_REVISION`), devolución tardía, rechazo con motivo, `START_PASSED`, `OVERLAP`, `RESOURCE_NOT_AVAILABLE`, matriz de permisos 401/403/404 y **aprobación concurrente** (dos sesiones: solo una gana). |

`test_permissions.py` (matriz rol × endpoint, de Persona A) se ejecuta sobre la base sembrada: el `conftest.py` la siembra automáticamente para ese módulo.

Las pruebas usan PostgreSQL real, porque la restricción `EXCLUDE USING gist` no existe en SQLite.

## Ejecutarlas en local

```bash
docker exec prestamos-db psql -U prestamos -d postgres -c "create database prestamos_test"
cd backend
python -m pytest -v
```

`TEST_DATABASE_URL` indica la base de pruebas (por defecto `…/prestamos_test`). Su nombre **debe terminar en `_test`**:
el esquema se recrea en cada ejecución y la prueba se niega a correr contra otra base.

## Recomendación

Marcar los jobs *Backend* y *Frontend* como comprobaciones obligatorias en la protección de `main` y `develop`
(Settings → Branches), para que no se pueda integrar un PR con las pruebas en rojo.

## Despliegue

El despliegue continuo a Azure parte de este CI: ver [`despliegue.md`](despliegue.md).
