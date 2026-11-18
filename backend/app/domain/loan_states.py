"""Máquina de estados de un préstamo (data-model.md, «Máquina de estados»)."""
from dataclasses import dataclass

from app.errors import AppError
from app.models.enums import LoanStatus

P, A, R, C, X, D = (
    LoanStatus.PENDIENTE,
    LoanStatus.APROBADA,
    LoanStatus.RECHAZADA,
    LoanStatus.CANCELADA,
    LoanStatus.ACTIVA,
    LoanStatus.DEVUELTA,
)


@dataclass(frozen=True)
class Transition:
    sources: frozenset[LoanStatus | None]
    target: LoanStatus
    role: str
    owner_only: bool = False


TRANSITIONS: dict[str, Transition] = {
    "create": Transition(frozenset({None}), P, "SOLICITANTE"),
    "approve": Transition(frozenset({P}), A, "RESPONSABLE"),
    "reject": Transition(frozenset({P, A}), R, "RESPONSABLE"),
    "cancel": Transition(frozenset({P, A}), C, "SOLICITANTE", owner_only=True),
    "deliver": Transition(frozenset({A}), X, "RESPONSABLE"),
    "return": Transition(frozenset({X}), D, "RESPONSABLE"),
}


def _val(x):
    return getattr(x, "value", x)


def assert_transition(loan, action: str, user) -> LoanStatus:
    """Valida rol (403 FORBIDDEN) y estado de origen (409 INVALID_TRANSITION).

    Devuelve el estado destino. Para `create`, `loan` puede ser `None`.
    """
    t = TRANSITIONS[action]
    if _val(user.role) != t.role:
        raise AppError(403, "FORBIDDEN", "No tienes permiso para realizar esta acción.")
    if t.owner_only and loan is not None and loan.requester_id != user.id:
        raise AppError(403, "FORBIDDEN", "Solo el solicitante puede realizar esta acción.")
    current = LoanStatus(_val(loan.status)) if loan is not None else None
    if current not in t.sources:
        raise AppError(
            409,
            "INVALID_TRANSITION",
            f"No se puede ejecutar «{action}» sobre una operación en estado {_val(current)}.",
        )
    return t.target
