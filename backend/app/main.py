from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, categories, dashboard, loans, resources, users
from app.config import get_settings
from app.errors import register_error_handlers

settings = get_settings()

app = FastAPI(
    title="Gestión de préstamos de equipos y recursos",
    description="API REST para el ciclo completo de préstamo: catálogo, solicitud, evaluación, "
    "entrega, devolución, historial y tablero de coordinación.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(loans.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/api/health", tags=["Sistema"], summary="Estado del servicio")
def health() -> dict:
    return {"status": "ok"}
