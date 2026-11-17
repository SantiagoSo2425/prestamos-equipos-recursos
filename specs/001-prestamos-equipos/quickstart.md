# Quickstart — validación de extremo a extremo

Guía para levantar el sistema localmente y demostrar el ciclo completo (prueba 12 de la guía).
Detalles de datos en [data-model.md](data-model.md) y de endpoints en [contracts/api.md](contracts/api.md).

## Prerrequisitos

- Python 3.12 (en esta máquina: `py -3.12`), Node.js ≥ 20, Git.
- PostgreSQL 16, una de dos opciones:
  - **Nativo**: instalador oficial de PostgreSQL 16 para Windows; crear BD `prestamos` y usuario.
  - **Contenedor (opcional, solo BD)**:
    `docker run -d --name prestamos-db -e POSTGRES_USER=prestamos -e POSTGRES_PASSWORD=<local> -e POSTGRES_DB=prestamos -p 5432:5432 postgres:16`
- Nota Windows: si una política bloquea ejecutables de `Scripts\`, usar siempre `python -m <herramienta>`.

## Backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env        # completar DATABASE_URL y JWT_SECRET locales
.\.venv\Scripts\python -m alembic upgrade head
.\.venv\Scripts\python -m app.seed
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Esperado: `http://localhost:8000/docs` muestra la documentación interactiva; `GET /api/health` → 200.

## Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env        # VITE_API_URL=http://localhost:8000/api
npm run dev
```

Esperado: `http://localhost:5173` muestra la pantalla de inicio de sesión.

## Usuarios de demostración (ficticios)

| Usuario | Rol | Notas |
|---|---|---|
| `est.ana` | SOLICITANTE / ESTUDIANTE | sin préstamos al iniciar |
| `est.luis` | SOLICITANTE / ESTUDIANTE | tiene un préstamo VENCIDO (bloqueado) |
| `doc.maria` | SOLICITANTE / DOCENTE | puede pedir recursos solo docentes |
| `resp.carlos` | RESPONSABLE | gestiona solicitudes y recursos |
| `coord.sofia` | COORDINACION | tablero de solo lectura |

Contraseña de demo: definida en `backend/.env.example` (`SEED_PASSWORD`), nunca credenciales reales.

## Escenarios de validación

| # | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| Q1 | Catálogo (CA-01) | `est.ana` → Catálogo → filtro Portátil + rango mañana | Disponibilidad coherente con préstamos semilla |
| Q2 | Solicitud (CA-02) | `est.ana` solicita PORT-002 mañana 08:00–12:00 | Aparece PENDIENTE en "Mis solicitudes" |
| Q3 | Solicitud inválida | fin < inicio / propósito vacío | Errores por campo, nada se guarda |
| Q4 | Evaluación (CA-03) | `resp.carlos` → Bandeja → aprobar Q2 | APROBADA, movimiento registrado |
| Q5 | No autorizado | Con token de `est.ana`: `POST /api/loans/{id}/approve` | 403 `FORBIDDEN` |
| Q6 | Conflicto | Aprobar otra PENDIENTE solapada de PORT-002 | 409 `OVERLAP`, sigue PENDIENTE |
| Q7 | Entrega (CA-04) | `resp.carlos` registra entrega de Q2 | ACTIVA; PORT-002 "Prestado" en catálogo |
| Q8 | Devolución (CA-05) | `resp.carlos` registra devolución BUENO | DEVUELTA; PORT-002 disponible; historial completo |
| Q9 | Daño | Devolver otro préstamo con CON_DANO | Recurso pasa a EN_REVISION |
| Q10 | Consolidado (CA-06) | `coord.sofia` → Tablero | Totales = conteo en BD; vencido de `est.luis` listado |
| Q11 | Flujo integral | Q2 → Q4 → Q7 → Q8 desde la UI + consulta SQL de `loans`/`loan_movements` | 4 movimientos en orden y datos coherentes |

Las pruebas formales PF-01…PF-12 (con precondiciones, datos, resultados y evidencias) se documentan en
`docs/pruebas.md` y la colección `docs/pruebas/prestamos.http`.
