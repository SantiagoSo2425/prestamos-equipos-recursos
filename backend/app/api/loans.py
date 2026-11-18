"""Endpoints de préstamos.

Sección A (Santiago): GET /loans, GET /loans/{id} (y en US2 POST /loans, POST /loans/{id}/cancel).
Sección B (Persona B): approve / reject / deliver / return — agregar al final del archivo.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.common import Page
from app.schemas.loan import CancelIn, EffectiveStatus, LoanCreate, LoanFilters, LoanOut
from app.schemas.movement import MovementOut
from app.services import loans as loan_service

router = APIRouter(prefix="/loans", tags=["Préstamos"])


# ---------------------------------------------------------------- Sección A
@router.get("", response_model=Page[LoanOut], summary="Listar solicitudes e historial")
def list_loans(
    status: EffectiveStatus | None = None,
    resource_id: int | None = None,
    category_id: int | None = None,
    requester_id: int | None = None,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort: Literal["-created_at", "created_at", "-start_at", "start_at"] = "-created_at",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Page[LoanOut]:
    filters = LoanFilters(
        status=status, resource_id=resource_id, category_id=category_id,
        requester_id=requester_id, from_=from_, to=to, page=page, size=size, sort=sort,
    )
    return loan_service.list_loans(db, user, filters)


@router.get("/{loan_id}", response_model=LoanOut, summary="Detalle de una operación")
def get_loan(
    loan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> LoanOut:
    return loan_service.to_loan_out(loan_service.get_loan(db, user, loan_id))


@router.post("", response_model=LoanOut, status_code=201, summary="Registrar solicitud")
def create_loan(
    data: LoanCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> LoanOut:
    return loan_service.to_loan_out(loan_service.create_loan(db, user, data))


@router.post("/{loan_id}/cancel", response_model=LoanOut, summary="Cancelar solicitud")
def cancel_loan(
    loan_id: int,
    data: CancelIn | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LoanOut:
    return loan_service.to_loan_out(loan_service.cancel_loan(db, user, loan_id, data or CancelIn()))


@router.get("/{loan_id}/movements", response_model=list[MovementOut], summary="Historial de movimientos")
def list_movements(
    loan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[MovementOut]:
    return loan_service.list_movements(db, user, loan_id)


# ---------------------------------------------------------------- Sección B
# (Persona B agrega aquí approve / reject / deliver / return)
