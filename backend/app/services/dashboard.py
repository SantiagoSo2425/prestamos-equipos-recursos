"""Tablero de coordinación (US6): consultas consolidadas de solo lectura."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.errors import AppError
from app.models.loan import Loan
from app.models.resource import Resource
from app.schemas.dashboard import CategoryUsage, ResourceUsage, SummaryOut, UsageOut
from app.services.loans import _loan_query, to_loan_out

LOAN_STATUSES = ["PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA", "ACTIVA", "VENCIDA", "DEVUELTA"]
RESOURCE_STATUSES = ["ACTIVO", "EN_REVISION", "DADO_DE_BAJA"]


def _val(x):
    return getattr(x, "value", x)


def get_summary(db: Session) -> SummaryOut:
    now = datetime.now(timezone.utc)

    loans_by_status = {s: 0 for s in LOAN_STATUSES}
    for status, count in db.execute(select(Loan.status, func.count()).group_by(Loan.status)).all():
        loans_by_status[_val(status)] = count
    # Las ACTIVA con fecha fin pasada se cuentan como VENCIDA y no como ACTIVA.
    vencidas = db.scalar(
        select(func.count()).select_from(Loan).where(Loan.status == "ACTIVA", Loan.end_at < now)
    ) or 0
    loans_by_status["ACTIVA"] -= vencidas
    loans_by_status["VENCIDA"] = vencidas

    resources_by_status = {s: 0 for s in RESOURCE_STATUSES}
    for status, count in db.execute(select(Resource.status, func.count()).group_by(Resource.status)).all():
        resources_by_status[_val(status)] = count

    activos = db.scalars(
        _loan_query().where(Loan.status == "ACTIVA", Loan.end_at >= now).order_by(Loan.end_at)
    ).unique().all()
    vencidos = db.scalars(
        _loan_query().where(Loan.status == "ACTIVA", Loan.end_at < now).order_by(Loan.end_at)
    ).unique().all()

    return SummaryOut(
        loans_by_status=loans_by_status,
        resources_by_status=resources_by_status,
        active_loans=[to_loan_out(x) for x in activos],
        overdue_loans=[to_loan_out(x) for x in vencidos],
    )


def get_usage(
    db: Session, from_: datetime | None, to: datetime | None, category_id: int | None
) -> UsageOut:
    now = datetime.now(timezone.utc)
    if to is None:
        to = now
    if from_ is None:
        from_ = to - timedelta(days=30)
    if from_ >= to:
        raise AppError(
            422, "VALIDATION_ERROR", "Datos inválidos.",
            [{"field": "from", "message": "'from' debe ser anterior a 'to'."}],
        )

    # Operaciones entregadas (ACTIVA/DEVUELTA) cuyo periodo real se solapa con el rango.
    fin_real = func.coalesce(Loan.returned_at, now)
    stmt = (
        select(Loan)
        .options(joinedload(Loan.resource).joinedload(Resource.category))
        .where(
            Loan.status.in_(["ACTIVA", "DEVUELTA"]),
            Loan.delivered_at.is_not(None),
            Loan.delivered_at < to,
            fin_real > from_,
        )
    )
    if category_id is not None:
        stmt = stmt.join(Resource, Loan.resource_id == Resource.id).where(Resource.category_id == category_id)

    by_cat: dict[str, dict] = {}
    by_res: dict[int, dict] = {}
    for ln in db.scalars(stmt).unique().all():
        inicio = max(ln.delivered_at, from_)
        fin = min(ln.returned_at or now, to)
        horas = max((fin - inicio).total_seconds(), 0) / 3600

        cat = by_cat.setdefault(ln.resource.category.name, {"loans": 0, "hours": 0.0})
        cat["loans"] += 1
        cat["hours"] += horas

        r = by_res.setdefault(
            ln.resource.id,
            {"code": ln.resource.code, "name": ln.resource.name, "loans": 0, "hours": 0.0, "last": None},
        )
        r["loans"] += 1
        r["hours"] += horas
        if r["last"] is None or ln.delivered_at > r["last"]:
            r["last"] = ln.delivered_at

    return UsageOut(
        by_category=[
            CategoryUsage(category=k, loans=v["loans"], hours=round(v["hours"], 2))
            for k, v in sorted(by_cat.items())
        ],
        by_resource=[
            ResourceUsage(
                resource_id=k, code=v["code"], name=v["name"], loans=v["loans"],
                hours=round(v["hours"], 2), last_loan_at=v["last"],
            )
            for k, v in sorted(by_res.items(), key=lambda kv: (-kv[1]["hours"], kv[1]["code"]))
        ],
    )
