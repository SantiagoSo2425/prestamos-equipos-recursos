"""Acciones del flujo de préstamo (Persona B): aprobar, rechazar, entregar y devolver.

Cada acción: bloquea la fila del préstamo → valida transición y reglas → modifica →
registra el movimiento, todo en la misma transacción (`get_db` hace el commit).
"""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.loan_states import assert_transition
from app.errors import AppError
from app.models.enums import ItemCondition, LoanStatus, ResourceStatus
from app.models.loan import Loan
from app.models.user import User
from app.schemas.loan import ApproveIn, DeliverIn, RejectIn, ReturnIn
from app.services import movements, rules


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _lock_loan(db: Session, loan_id: int) -> Loan:
    loan = db.scalars(select(Loan).where(Loan.id == loan_id).with_for_update()).one_or_none()
    if loan is None:
        raise AppError(404, "NOT_FOUND", "La operación no existe.")
    return loan


def _flush(db: Session) -> None:
    """Fuerza la escritura para que una violación de `loans_no_overlap` se vea aquí."""
    try:
        db.flush()
    except IntegrityError as exc:
        err = rules.translate_integrity_error(exc)
        if err is None:
            raise
        raise err from exc


def approve_loan(db: Session, actor: User, loan_id: int, data: ApproveIn) -> Loan:
    loan = _lock_loan(db, loan_id)
    target = assert_transition(loan, "approve", actor)
    now = _now()
    if loan.start_at <= now:
        raise AppError(409, "START_PASSED", "El inicio solicitado ya pasó; no se puede aprobar.")
    resource = rules.lock_resource(db, loan.resource_id)
    requester = rules.lock_user(db, loan.requester_id)
    rules.check_can_request(db, requester, resource, loan.start_at, loan.end_at, exclude_loan_id=loan.id)

    previous = loan.status
    loan.status = target
    loan.approved_by_id = actor.id
    loan.approved_at = now
    _flush(db)
    movements.record(db, loan, actor, previous, target, data.note)
    return loan


def reject_loan(db: Session, actor: User, loan_id: int, data: RejectIn) -> Loan:
    loan = _lock_loan(db, loan_id)
    target = assert_transition(loan, "reject", actor)
    previous = loan.status
    loan.status = target
    loan.rejection_reason = data.reason
    _flush(db)
    movements.record(db, loan, actor, previous, target, data.reason)
    return loan


def deliver_loan(db: Session, actor: User, loan_id: int, data: DeliverIn) -> Loan:
    loan = _lock_loan(db, loan_id)
    target = assert_transition(loan, "deliver", actor)
    resource = rules.lock_resource(db, loan.resource_id)
    if resource.status != ResourceStatus.ACTIVO:
        raise AppError(409, "RESOURCE_NOT_AVAILABLE", "El recurso no está operativo.")
    already_out = db.scalar(
        select(func.count()).select_from(Loan).where(
            Loan.resource_id == resource.id, Loan.status == LoanStatus.ACTIVA, Loan.id != loan.id
        )
    )
    if already_out:
        raise AppError(
            409, "RESOURCE_NOT_AVAILABLE", "El recurso ya está entregado en otro préstamo activo."
        )
    now = _now()
    delivered_at = data.delivered_at or now
    if delivered_at > now:
        raise AppError(
            422, "VALIDATION_ERROR", "Datos inválidos.",
            [{"field": "delivered_at", "message": "La fecha de entrega no puede ser futura."}],
        )
    previous = loan.status
    loan.status = target
    loan.delivered_by_id = actor.id
    loan.delivered_at = delivered_at
    loan.checkout_condition = data.checkout_condition
    _flush(db)
    movements.record(db, loan, actor, previous, target, f"Condición de salida: {data.checkout_condition}")
    return loan


def return_loan(db: Session, actor: User, loan_id: int, data: ReturnIn) -> Loan:
    loan = _lock_loan(db, loan_id)
    target = assert_transition(loan, "return", actor)
    resource = rules.lock_resource(db, loan.resource_id)
    now = _now()
    returned_at = data.returned_at or now
    if returned_at > now:
        raise AppError(
            422, "VALIDATION_ERROR", "Datos inválidos.",
            [{"field": "returned_at", "message": "La fecha de devolución no puede ser futura."}],
        )
    if loan.delivered_at is not None and returned_at < loan.delivered_at:
        raise AppError(
            422, "VALIDATION_ERROR", "Datos inválidos.",
            [{"field": "returned_at", "message": "No puede ser anterior a la fecha de entrega."}],
        )
    previous = loan.status
    loan.status = target
    loan.received_by_id = actor.id
    loan.returned_at = returned_at
    loan.return_condition = ItemCondition(data.return_condition)
    loan.return_notes = data.return_notes
    loan.is_late = returned_at > loan.end_at
    note = data.return_notes
    if loan.return_condition == ItemCondition.CON_DANO:
        resource.status = ResourceStatus.EN_REVISION
        note = f"Devuelto con daño; el recurso pasa a EN_REVISION. {data.return_notes}"
    _flush(db)
    movements.record(db, loan, actor, previous, target, note)
    return loan
