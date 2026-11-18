"""Endpoints de préstamos.

Sección A (Santiago): GET /loans, GET /loans/{id} (y en US2 POST /loans, POST /loans/{id}/cancel).
Sección B (Persona B): approve / reject / deliver / return — agregar al final del archivo.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.user import User
from app.schemas.common import Page
from app.schemas.loan import (
    ApproveIn, DeliverIn, EffectiveStatus, LoanFilters, LoanOut, RejectIn, ReturnIn,
)
from app.services import loan_workflow as workflow
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


# ---------------------------------------------------------------- Sección B
@router.post("/{loan_id}/approve", response_model=LoanOut, summary="Aprobar una solicitud")
def approve(
    loan_id: int,
    data: ApproveIn | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("RESPONSABLE")),
) -> LoanOut:
    loan = workflow.approve_loan(db, user, loan_id, data or ApproveIn())
    return loan_service.to_loan_out(loan)


@router.post("/{loan_id}/reject", response_model=LoanOut, summary="Rechazar con motivo")
def reject(
    loan_id: int,
    data: RejectIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("RESPONSABLE")),
) -> LoanOut:
    return loan_service.to_loan_out(workflow.reject_loan(db, user, loan_id, data))


@router.post("/{loan_id}/deliver", response_model=LoanOut, summary="Registrar la entrega")
def deliver(
    loan_id: int,
    data: DeliverIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("RESPONSABLE")),
) -> LoanOut:
    return loan_service.to_loan_out(workflow.deliver_loan(db, user, loan_id, data))


@router.post("/{loan_id}/return", response_model=LoanOut, summary="Registrar la devolución")
def return_(
    loan_id: int,
    data: ReturnIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("RESPONSABLE")),
) -> LoanOut:
    return loan_service.to_loan_out(workflow.return_loan(db, user, loan_id, data))
