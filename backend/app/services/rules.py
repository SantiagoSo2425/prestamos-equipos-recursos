"""Reglas de negocio compartidas (V1–V7 de data-model.md).

Las usan `create_loan` (Persona A) y `approve_loan` (Persona B), de modo que la
validación vive en un único lugar y siempre en el servidor.
"""
from datetime import datetime, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models.enums import LoanStatus, RequesterType, ResourceStatus
from app.models.loan import Loan
from app.models.resource import Resource
from app.models.user import User

LIMITS = {RequesterType.ESTUDIANTE: 2, RequesterType.DOCENTE: 5}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def find_overlaps(
    db: Session, resource_id: int, start: datetime, end: datetime, exclude_loan_id: int | None = None
) -> list[Loan]:
    """Préstamos APROBADA/ACTIVA del recurso que chocan con `[start, end)`.

    Una ACTIVA vencida sigue ocupando el recurso hasta su devolución: `[start_at, +∞)`.
    """
    now = _now()
    conds = [
        Loan.resource_id == resource_id,
        Loan.status.in_([LoanStatus.APROBADA, LoanStatus.ACTIVA]),
        Loan.start_at < end,
        or_(Loan.end_at > start, and_(Loan.status == LoanStatus.ACTIVA, Loan.end_at < now)),
    ]
    if exclude_loan_id is not None:
        conds.append(Loan.id != exclude_loan_id)
    return list(db.scalars(select(Loan).where(*conds).order_by(Loan.start_at)))


def is_available(
    db: Session, resource_id: int, start: datetime, end: datetime, exclude_loan_id: int | None = None
) -> bool:
    return not find_overlaps(db, resource_id, start, end, exclude_loan_id)


def lock_resource(db: Session, resource_id: int) -> Resource:
    """`SELECT … FOR UPDATE` del recurso: serializa decisiones concurrentes sobre él."""
    resource = db.scalars(
        select(Resource).where(Resource.id == resource_id).with_for_update()
    ).one_or_none()
    if resource is None:
        raise AppError(404, "NOT_FOUND", "El recurso no existe.")
    return resource


def lock_user(db: Session, user_id: int) -> User:
    """`SELECT … FOR UPDATE` del solicitante: serializa el conteo de su límite (V6)."""
    user = db.scalars(select(User).where(User.id == user_id).with_for_update()).one_or_none()
    if user is None:
        raise AppError(404, "NOT_FOUND", "El usuario no existe.")
    return user


def _422(field: str, message: str) -> AppError:
    return AppError(422, "VALIDATION_ERROR", "Datos inválidos.", [{"field": field, "message": message}])


def check_can_request(
    db: Session,
    user: User,
    resource: Resource,
    start: datetime,
    end: datetime,
    exclude_loan_id: int | None = None,
) -> None:
    """Aplica V1…V7 en orden. `user` es el solicitante de la operación."""
    now = _now()
    # V1: fechas coherentes
    if start < now:
        raise _422("start_at", "La fecha de inicio no puede estar en el pasado.")
    if end <= start:
        raise _422("end_at", "Debe ser posterior a la fecha de inicio.")
    # V2: duración máxima de la categoría
    max_hours = resource.category.max_loan_hours
    if (end - start).total_seconds() > max_hours * 3600:
        raise _422("end_at", f"La duración máxima para esta categoría es de {max_hours} horas.")
    # V3: recurso operativo
    if resource.status != ResourceStatus.ACTIVO:
        raise AppError(409, "RESOURCE_NOT_AVAILABLE", "El recurso no está disponible para préstamo.")
    # V4: recursos solo para docentes
    if resource.teacher_only and user.requester_type != RequesterType.DOCENTE:
        raise AppError(403, "TEACHER_ONLY", "Este recurso solo puede ser solicitado por docentes.")
    # V5: sin préstamos vencidos
    overdue = db.scalar(
        select(func.count()).select_from(Loan).where(
            Loan.requester_id == user.id, Loan.status == LoanStatus.ACTIVA, Loan.end_at < now
        )
    )
    if overdue:
        raise AppError(
            409, "OVERDUE_BLOCK", "El solicitante tiene préstamos vencidos sin devolver."
        )
    # V6: límite de préstamos simultáneos
    conds = [Loan.requester_id == user.id, Loan.status.in_([LoanStatus.APROBADA, LoanStatus.ACTIVA])]
    if exclude_loan_id is not None:
        conds.append(Loan.id != exclude_loan_id)
    held = db.scalar(select(func.count()).select_from(Loan).where(*conds)) or 0
    limit = LIMITS.get(user.requester_type, 2)
    if held >= limit:
        raise AppError(
            409, "LIMIT_REACHED", f"Se alcanzó el límite de {limit} préstamos simultáneos."
        )
    # V7: sin solapamiento
    if find_overlaps(db, resource.id, start, end, exclude_loan_id):
        raise AppError(409, "OVERLAP", "El recurso ya está reservado en ese periodo.")


def translate_integrity_error(exc: IntegrityError) -> AppError | None:
    """Convierte la violación de `loans_no_overlap` en 409 OVERLAP; otras, `None`."""
    if "loans_no_overlap" in str(getattr(exc, "orig", exc)):
        return AppError(409, "OVERLAP", "El recurso ya está reservado en ese periodo.")
    return None
