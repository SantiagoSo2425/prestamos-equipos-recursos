"""Servicio de préstamos.

Sección A (Santiago): lectura (`list_loans`, `get_loan`, `to_loan_out`) y, en US2,
`create_loan` / `cancel_loan`. Las acciones de flujo (aprobar, entregar…) viven en
`loan_workflow.py` (Persona B).
"""
import math
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.errors import AppError
from app.domain import loan_states
from app.models.enums import LoanStatus
from app.models.loan import Loan
from app.models.movement import LoanMovement
from app.models.resource import Resource
from app.models.user import User
from app.schemas.common import Page
from app.schemas.loan import CancelIn, LoanCreate, LoanFilters, LoanOut
from app.schemas.movement import MovementOut
from app.services import movements, rules

_SORTS = {
    "created_at": Loan.created_at.asc(),
    "-created_at": Loan.created_at.desc(),
    "start_at": Loan.start_at.asc(),
    "-start_at": Loan.start_at.desc(),
}


def _role(user: User) -> str:
    return getattr(user.role, "value", user.role)


def _val(x):
    return getattr(x, "value", x)


def _loan_query():
    return select(Loan).options(
        joinedload(Loan.resource).joinedload(Resource.category),
        joinedload(Loan.requester),
        joinedload(Loan.approved_by),
        joinedload(Loan.delivered_by),
        joinedload(Loan.received_by),
    )


def to_loan_out(loan: Loan) -> LoanOut:
    """Convierte un `Loan` ORM en `LoanOut` calculando estado efectivo y días de retraso."""
    now = datetime.now(timezone.utc)
    status = _val(loan.status)
    overdue = status == "ACTIVA" and loan.end_at < now
    days_overdue = max(1, math.ceil((now - loan.end_at).total_seconds() / 86400)) if overdue else 0
    return LoanOut(
        id=loan.id,
        resource={
            "id": loan.resource.id,
            "code": loan.resource.code,
            "name": loan.resource.name,
            "category": loan.resource.category.name,
        },
        requester={
            "id": loan.requester.id,
            "username": loan.requester.username,
            "full_name": loan.requester.full_name,
            "requester_type": _val(loan.requester.requester_type),
        },
        start_at=loan.start_at,
        end_at=loan.end_at,
        purpose=loan.purpose,
        status=status,
        effective_status="VENCIDA" if overdue else status,
        rejection_reason=loan.rejection_reason,
        approved_by=loan.approved_by,
        approved_at=loan.approved_at,
        delivered_by=loan.delivered_by,
        delivered_at=loan.delivered_at,
        checkout_condition=loan.checkout_condition,
        received_by=loan.received_by,
        returned_at=loan.returned_at,
        return_condition=_val(loan.return_condition) if loan.return_condition else None,
        return_notes=loan.return_notes,
        is_late=loan.is_late,
        days_overdue=days_overdue,
        created_at=loan.created_at,
        updated_at=loan.updated_at,
    )


def list_loans(db: Session, user: User, f: LoanFilters) -> Page[LoanOut]:
    if (f.from_ is None) != (f.to is None):
        raise AppError(
            422, "VALIDATION_ERROR", "Datos inválidos.",
            [{"field": "from", "message": "Debes enviar 'from' y 'to' juntos."}],
        )
    if f.from_ is not None and f.from_ >= f.to:
        raise AppError(
            422, "VALIDATION_ERROR", "Datos inválidos.",
            [{"field": "from", "message": "'from' debe ser anterior a 'to'."}],
        )

    now = datetime.now(timezone.utc)
    conds = []
    if _role(user) == "SOLICITANTE":
        conds.append(Loan.requester_id == user.id)  # un solicitante solo ve lo suyo
    elif f.requester_id is not None:
        conds.append(Loan.requester_id == f.requester_id)

    if f.status == "VENCIDA":
        conds += [Loan.status == "ACTIVA", Loan.end_at < now]
    elif f.status == "ACTIVA":
        conds += [Loan.status == "ACTIVA", Loan.end_at >= now]
    elif f.status is not None:
        conds.append(Loan.status == f.status)

    if f.resource_id is not None:
        conds.append(Loan.resource_id == f.resource_id)
    if f.category_id is not None:
        conds.append(Loan.resource_id.in_(select(Resource.id).where(Resource.category_id == f.category_id)))
    if f.from_ is not None:
        conds += [Loan.start_at < f.to, Loan.end_at > f.from_]

    size = max(1, min(f.size, 100))
    page = max(1, f.page)
    total = db.scalar(select(func.count()).select_from(Loan).where(*conds)) or 0
    rows = (
        db.scalars(
            _loan_query().where(*conds).order_by(_SORTS[f.sort], Loan.id.desc())
            .offset((page - 1) * size).limit(size)
        )
        .unique()
        .all()
    )
    return Page[LoanOut](items=[to_loan_out(r) for r in rows], total=total, page=page, size=size)


def get_loan(db: Session, user: User, loan_id: int) -> Loan:
    """404 si no existe o (para SOLICITANTE) no es suyo, para no filtrar su existencia."""
    loan = db.scalars(_loan_query().where(Loan.id == loan_id)).unique().one_or_none()
    if loan is None or (_role(user) == "SOLICITANTE" and loan.requester_id != user.id):
        raise AppError(404, "NOT_FOUND", "La operación no existe.")
    return loan


# ---------------------------------------------------------------- US2: crear y cancelar
def create_loan(db: Session, user: User, data: LoanCreate) -> Loan:
    if _role(user) != "SOLICITANTE":
        raise AppError(403, "FORBIDDEN", "Solo un solicitante puede registrar solicitudes.")
    resource = db.get(Resource, data.resource_id)
    if resource is None:
        raise AppError(404, "NOT_FOUND", "El recurso no existe.")

    rules.lock_user(db, user.id)  # serializa solicitudes simultáneas del mismo usuario
    rules.check_can_request(db, user, resource, data.start_at, data.end_at)  # V1–V7

    loan = Loan(
        resource_id=resource.id,
        requester_id=user.id,
        start_at=data.start_at,
        end_at=data.end_at,
        purpose=data.purpose,
        status=LoanStatus.PENDIENTE,
    )
    db.add(loan)
    db.flush()
    movements.record(db, loan, user, None, LoanStatus.PENDIENTE)
    db.refresh(loan)
    return loan


def cancel_loan(db: Session, user: User, loan_id: int, data: CancelIn) -> Loan:
    loan = get_loan(db, user, loan_id)  # 404 si no existe o es ajena
    if _role(user) != "SOLICITANTE":
        raise AppError(403, "FORBIDDEN", "Solo el solicitante puede cancelar su solicitud.")
    loan_states.assert_transition(loan, "cancel", user)
    previous = loan.status
    loan.status = LoanStatus.CANCELADA
    db.flush()
    movements.record(db, loan, user, previous, LoanStatus.CANCELADA, data.note)
    db.refresh(loan)
    return loan


# ---------------------------------------------------------------- US2: historial
def list_movements(db: Session, user: User, loan_id: int) -> list[MovementOut]:
    loan = get_loan(db, user, loan_id)  # aplica la regla de propiedad (404 si ajena)
    rows = db.scalars(
        select(LoanMovement)
        .options(joinedload(LoanMovement.actor))
        .where(LoanMovement.loan_id == loan.id)
        .order_by(LoanMovement.created_at, LoanMovement.id)
    ).unique().all()
    return [
        MovementOut(
            id=m.id,
            actor={"id": m.actor.id, "username": m.actor.username, "full_name": m.actor.full_name},
            from_status=_val(m.from_status) if m.from_status else None,
            to_status=_val(m.to_status),
            note=m.note,
            created_at=m.created_at,
        )
        for m in rows
    ]
