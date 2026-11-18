"""Servicio de recursos: catálogo con disponibilidad (US1) y administración (US7)."""
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.errors import AppError
from app.models.category import Category
from app.models.enums import LoanStatus, ResourceStatus
from app.models.loan import Loan
from app.models.resource import Resource
from app.models.user import User
from app.schemas.common import Page
from app.schemas.resource import (
    BusyPeriod,
    CategoryOut,
    ResourceCreate,
    ResourceDetailOut,
    ResourceOut,
    ResourceUpdate,
)
from app.services import rules


def _val(x):
    return getattr(x, "value", x)


def _422(field: str, message: str) -> AppError:
    return AppError(422, "VALIDATION_ERROR", "Datos inválidos.", [{"field": field, "message": message}])


def list_categories(db: Session) -> list[CategoryOut]:
    rows = db.scalars(select(Category).order_by(Category.name)).all()
    return [CategoryOut(id=c.id, name=c.name, max_loan_hours=c.max_loan_hours) for c in rows]


def _availability(
    db: Session, resource: Resource, start: datetime | None, end: datetime | None
) -> tuple[bool | None, str | None]:
    """Disponibilidad en [start, end): recurso ACTIVO y sin solape APROBADA/ACTIVA."""
    if start is None or end is None:
        return None, None
    if _val(resource.status) != "ACTIVO":
        return False, "NO_ACTIVO"
    overlaps = rules.find_overlaps(db, resource.id, start, end)
    if not overlaps:
        return True, None
    prestado = any(_val(o.status) == "ACTIVA" for o in overlaps)
    return False, "PRESTADO" if prestado else "RESERVADO"


def _to_out(db: Session, r: Resource, start: datetime | None, end: datetime | None) -> ResourceOut:
    available, reason = _availability(db, r, start, end)
    return ResourceOut(
        id=r.id,
        code=r.code,
        name=r.name,
        description=r.description,
        category=CategoryOut(id=r.category.id, name=r.category.name, max_loan_hours=r.category.max_loan_hours),
        status=_val(r.status),
        teacher_only=r.teacher_only,
        available=available,
        unavailable_reason=reason,
    )


def list_resources(
    db: Session,
    user: User,
    category_id: int | None,
    q: str | None,
    status: str | None,
    from_: datetime | None,
    to: datetime | None,
    available_only: bool,
    page: int,
    size: int,
) -> Page[ResourceOut]:
    if (from_ is None) != (to is None):
        raise _422("from", "Debes enviar 'from' y 'to' juntos.")
    if from_ is not None and from_ >= to:
        raise _422("from", "'from' debe ser anterior a 'to'.")
    if available_only and from_ is None:
        raise _422("from", "Para filtrar solo disponibles debes indicar el rango 'from' y 'to'.")

    size = max(1, min(size, 100))
    page = max(1, page)

    conds = []
    if category_id is not None:
        conds.append(Resource.category_id == category_id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        conds.append(or_(Resource.code.ilike(like), Resource.name.ilike(like)))
    if status:
        conds.append(Resource.status == status)
    if _val(user.role) == "SOLICITANTE":
        conds.append(Resource.status != ResourceStatus.DADO_DE_BAJA)

    stmt = select(Resource).options(joinedload(Resource.category)).where(*conds).order_by(Resource.code)
    rows = db.scalars(stmt).unique().all()

    if available_only:
        # La disponibilidad se calcula por recurso, por eso se filtra antes de paginar.
        outs = [o for o in (_to_out(db, r, from_, to) for r in rows) if o.available]
        total = len(outs)
        items = outs[(page - 1) * size : page * size]
    else:
        total = len(rows)
        items = [_to_out(db, r, from_, to) for r in rows[(page - 1) * size : page * size]]
    return Page[ResourceOut](items=items, total=total, page=page, size=size)


def _get_resource(db: Session, resource_id: int) -> Resource:
    r = db.scalars(
        select(Resource).options(joinedload(Resource.category)).where(Resource.id == resource_id)
    ).unique().one_or_none()
    if r is None:
        raise AppError(404, "NOT_FOUND", "El recurso no existe.")
    return r


def get_resource_detail(db: Session, resource_id: int) -> ResourceDetailOut:
    r = _get_resource(db, resource_id)
    now = datetime.now(timezone.utc)
    loans = db.scalars(
        select(Loan)
        .where(
            Loan.resource_id == r.id,
            Loan.status.in_([LoanStatus.APROBADA, LoanStatus.ACTIVA]),
        )
        .order_by(Loan.start_at)
    ).all()
    busy: list[BusyPeriod] = []
    for ln in loans:
        activa = _val(ln.status) == "ACTIVA"
        if not activa and ln.end_at <= now:
            continue  # reserva ya pasada: no ocupa nada
        # ACTIVA vencida ocupa de forma abierta hasta que se devuelva
        end_at = None if activa and ln.end_at < now else ln.end_at
        busy.append(BusyPeriod(loan_id=ln.id, start_at=ln.start_at, end_at=end_at, status=_val(ln.status)))
    base = _to_out(db, r, None, None)
    return ResourceDetailOut(**base.model_dump(), busy_periods=busy)


# ---------------------------------------------------------------- Administración (US7)
def _category_or_422(db: Session, category_id: int) -> Category:
    cat = db.get(Category, category_id)
    if cat is None:
        raise _422("category_id", "La categoría no existe.")
    return cat


def create_resource(db: Session, data: ResourceCreate) -> ResourceOut:
    _category_or_422(db, data.category_id)
    if db.scalar(select(Resource.id).where(Resource.code == data.code)) is not None:
        raise AppError(409, "DUPLICATE_CODE", f"Ya existe un recurso con el código {data.code}.")
    resource = Resource(
        code=data.code,
        name=data.name,
        description=data.description,
        category_id=data.category_id,
        teacher_only=data.teacher_only,
        status=ResourceStatus.ACTIVO,
    )
    db.add(resource)
    try:
        db.flush()
    except IntegrityError:  # carrera entre dos altas con el mismo código
        db.rollback()
        raise AppError(409, "DUPLICATE_CODE", f"Ya existe un recurso con el código {data.code}.")
    return _to_out(db, _get_resource(db, resource.id), None, None)


def update_resource(db: Session, resource_id: int, data: ResourceUpdate) -> ResourceOut:
    resource = _get_resource(db, resource_id)
    changes = data.model_dump(exclude_unset=True)

    for field in ("name", "category_id", "teacher_only", "status"):
        if field in changes and changes[field] is None:
            raise _422(field, "Este campo no puede ser nulo.")
    if "name" in changes:
        changes["name"] = changes["name"].strip()
        if not changes["name"]:
            raise _422("name", "El nombre no puede estar vacío.")
    if "category_id" in changes:
        _category_or_422(db, changes["category_id"])

    new_status = changes.get("status")
    if new_status in ("EN_REVISION", "DADO_DE_BAJA") and _val(resource.status) != new_status:
        en_uso = db.scalar(
            select(Loan.id).where(Loan.resource_id == resource.id, Loan.status == LoanStatus.ACTIVA).limit(1)
        )
        if en_uso is not None:
            raise AppError(
                409,
                "RESOURCE_IN_USE",
                "El recurso tiene un préstamo activo; registra la devolución antes de cambiar su estado.",
            )

    for field, value in changes.items():
        setattr(resource, field, ResourceStatus(value) if field == "status" else value)
    db.flush()
    db.refresh(resource)
    return _to_out(db, _get_resource(db, resource.id), None, None)
