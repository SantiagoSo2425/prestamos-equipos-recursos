from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.schemas.dashboard import SummaryOut, UsageOut
from app.services import dashboard as dashboard_service

router = APIRouter(
    prefix="/dashboard",
    tags=["Tablero"],
    dependencies=[Depends(require_roles("RESPONSABLE", "COORDINACION"))],
)


@router.get("/summary", response_model=SummaryOut, summary="Totales y préstamos activos/vencidos")
def summary(db: Session = Depends(get_db)) -> SummaryOut:
    return dashboard_service.get_summary(db)


@router.get("/usage", response_model=UsageOut, summary="Uso por recurso y categoría")
def usage(
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    category_id: int | None = None,
    db: Session = Depends(get_db),
) -> UsageOut:
    return dashboard_service.get_usage(db, from_, to, category_id)
