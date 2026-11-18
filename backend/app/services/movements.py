"""Historial de movimientos: solo inserción (FR-029). No hay update ni delete."""
from sqlalchemy.orm import Session

from app.models.loan import Loan
from app.models.movement import LoanMovement
from app.models.user import User


def record(
    db: Session, loan: Loan, actor: User, from_status, to_status, note: str | None = None
) -> LoanMovement:
    mv = LoanMovement(
        loan_id=loan.id,
        actor_id=actor.id,
        from_status=from_status,
        to_status=to_status,
        note=note,
    )
    db.add(mv)
    db.flush()
    return mv
