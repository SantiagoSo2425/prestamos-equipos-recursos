#!/bin/sh
# Aplica las migraciones pendientes y levanta la API. Con una sola instancia no hay carrera entre
# migraciones; si se escala a varias réplicas, mover `alembic` a un paso propio del despliegue.
set -e
python -m alembic upgrade head
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
