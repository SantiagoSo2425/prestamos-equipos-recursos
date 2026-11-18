"""Datos de demostración (ficticios). Idempotente: `python -m app.seed`."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import (
    Category, ItemCondition, Loan, LoanMovement, LoanStatus, RequesterType,
    Resource, ResourceStatus, User, UserRole,
)
from app.security import hash_password

CATEGORIES = [("Portátil", 72), ("Cámara", 48), ("Instrumento", 24), ("Otro", 72)]

# (username, nombre, id institucional, rol, tipo de solicitante)
USERS = [
    ("est.ana", "Ana Torres (demo)", "E1001", UserRole.SOLICITANTE, RequesterType.ESTUDIANTE),
    ("est.luis", "Luis Ramírez (demo)", "E1002", UserRole.SOLICITANTE, RequesterType.ESTUDIANTE),
    ("doc.maria", "María Gómez (demo)", "D2001", UserRole.SOLICITANTE, RequesterType.DOCENTE),
    ("resp.carlos", "Carlos Peña (demo)", "R3001", UserRole.RESPONSABLE, None),
    ("coord.sofia", "Sofía Vargas (demo)", "C4001", UserRole.COORDINACION, None),
]

# (código, nombre, categoría, estado, solo docentes)
RESOURCES = [
    ("PORT-001", "Portátil Lenovo T14 #1", "Portátil", ResourceStatus.ACTIVO, False),
    ("PORT-002", "Portátil Lenovo T14 #2", "Portátil", ResourceStatus.ACTIVO, False),
    ("PORT-003", "Portátil HP ProBook #1", "Portátil", ResourceStatus.ACTIVO, False),
    ("PORT-004", "Portátil HP ProBook #2", "Portátil", ResourceStatus.ACTIVO, False),
    ("CAM-001", "Cámara Canon EOS 250D", "Cámara", ResourceStatus.ACTIVO, False),
    ("CAM-002", "Cámara Sony Alpha 6100", "Cámara", ResourceStatus.ACTIVO, False),
    ("CAM-003", "Cámara GoPro Hero 11", "Cámara", ResourceStatus.EN_REVISION, False),
    ("INST-001", "Osciloscopio Rigol DS1054Z", "Instrumento", ResourceStatus.ACTIVO, True),
    ("INST-002", "Multímetro Fluke 117", "Instrumento", ResourceStatus.ACTIVO, False),
    ("INST-003", "Fuente de poder 30 V", "Instrumento", ResourceStatus.ACTIVO, False),
    ("OTRO-001", "Proyector Epson X49", "Otro", ResourceStatus.ACTIVO, False),
    ("OTRO-002", "Tablero digitalizador", "Otro", ResourceStatus.DADO_DE_BAJA, False),
]


def _get_or_create_users(db: Session) -> dict[str, User]:
    password = get_settings().seed_password
    if not password:
        raise SystemExit("Define SEED_PASSWORD en backend/.env antes de ejecutar la semilla.")
    out: dict[str, User] = {}
    for username, name, inst, role, rtype in USERS:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(
                username=username, full_name=name, institutional_id=inst,
                password_hash=hash_password(password), role=role, requester_type=rtype,
            )
            db.add(user)
        out[username] = user
    db.flush()
    return out


def _get_or_create_catalog(db: Session) -> dict[str, Resource]:
    cats: dict[str, Category] = {}
    for name, hours in CATEGORIES:
        cat = db.scalar(select(Category).where(Category.name == name))
        if cat is None:
            cat = Category(name=name, max_loan_hours=hours)
            db.add(cat)
        cats[name] = cat
    db.flush()
    res: dict[str, Resource] = {}
    for code, name, cat, status, teacher_only in RESOURCES:
        r = db.scalar(select(Resource).where(Resource.code == code))
        if r is None:
            r = Resource(
                code=code, name=name, category_id=cats[cat].id, status=status, teacher_only=teacher_only,
                description=f"{name} — recurso de demostración.",
            )
            db.add(r)
        res[code] = r
    db.flush()
    return res


def _loan(db, users, res, *, who, code, start, end, status, purpose, history, **extra) -> Loan:
    """Crea un préstamo y sus movimientos. `history` = [(actor, from, to, nota, momento), ...]."""
    loan = Loan(
        resource_id=res[code].id, requester_id=users[who].id, start_at=start, end_at=end,
        purpose=purpose, status=status, **extra,
    )
    db.add(loan)
    db.flush()
    for actor, frm, to, note, when in history:
        db.add(LoanMovement(
            loan_id=loan.id, actor_id=users[actor].id, from_status=frm, to_status=to, note=note, created_at=when,
        ))
    return loan


def _seed_loans(db: Session, users: dict[str, User], res: dict[str, Resource]) -> None:
    if db.scalar(select(Loan.id).limit(1)) is not None:
        return  # ya hay préstamos: no se duplican
    P, A, R, C, X, D = (
        LoanStatus.PENDIENTE, LoanStatus.APROBADA, LoanStatus.RECHAZADA,
        LoanStatus.CANCELADA, LoanStatus.ACTIVA, LoanStatus.DEVUELTA,
    )
    now = datetime.now(timezone.utc).replace(microsecond=0)
    h, d = timedelta(hours=1), timedelta(days=1)
    L = lambda **kw: _loan(db, users, res, **kw)  # noqa: E731

    # 1) ACTIVA y vencida de est.luis (lo bloquea para nuevas solicitudes)
    s = now - 5 * d
    L(who="est.luis", code="PORT-001", start=s, end=now - 2 * d, status=X,
      purpose="Desarrollo del proyecto de redes (demo)", approved_by_id=users["resp.carlos"].id,
      approved_at=s - 2 * h, delivered_by_id=users["resp.carlos"].id, delivered_at=s,
      checkout_condition="Completo, con cargador",
      history=[("est.luis", None, P, None, s - 1 * d), ("resp.carlos", P, A, None, s - 2 * h),
               ("resp.carlos", A, X, "Condición de salida: Completo, con cargador", s)])

    # 2 y 3) dos PENDIENTES solapadas del mismo recurso
    s = (now + 2 * d).replace(hour=13, minute=0, second=0)
    L(who="est.ana", code="CAM-001", start=s, end=s + 4 * h, status=P,
      purpose="Grabación del video de la práctica final (demo)",
      history=[("est.ana", None, P, None, now - 3 * h)])
    L(who="doc.maria", code="CAM-001", start=s + 2 * h, end=s + 6 * h, status=P,
      purpose="Registro audiovisual de la clase magistral (demo)",
      history=[("doc.maria", None, P, None, now - 2 * h)])

    # 4) APROBADA futura
    s = (now + 1 * d).replace(hour=14, minute=0, second=0)
    L(who="est.ana", code="PORT-002", start=s, end=s + 4 * h, status=A,
      purpose="Práctica de laboratorio de redes (demo)", approved_by_id=users["resp.carlos"].id,
      approved_at=now - 1 * h,
      history=[("est.ana", None, P, None, now - 5 * h), ("resp.carlos", P, A, None, now - 1 * h)])

    # 5) DEVUELTA a tiempo, en buen estado
    s = now - 10 * d
    L(who="doc.maria", code="PORT-003", start=s, end=s + 1 * d, status=D,
      purpose="Calificación de trabajos en el aula (demo)", approved_by_id=users["resp.carlos"].id,
      approved_at=s - 3 * h, delivered_by_id=users["resp.carlos"].id, delivered_at=s,
      checkout_condition="Completo", received_by_id=users["resp.carlos"].id,
      returned_at=s + 20 * h, return_condition=ItemCondition.BUENO, is_late=False,
      history=[("doc.maria", None, P, None, s - 1 * d), ("resp.carlos", P, A, None, s - 3 * h),
               ("resp.carlos", A, X, "Condición de salida: Completo", s),
               ("resp.carlos", X, D, None, s + 20 * h)])

    # 6) RECHAZADA con motivo
    s = now + 3 * d
    L(who="est.ana", code="PORT-004", start=s, end=s + 2 * h, status=R,
      purpose="Revisar correo personal (demo)", rejection_reason="El recurso es solo para actividades académicas.",
      history=[("est.ana", None, P, None, now - 6 * h),
               ("resp.carlos", P, R, "El recurso es solo para actividades académicas.", now - 5 * h)])

    # 7) CANCELADA por el solicitante
    s = now + 4 * d
    L(who="est.ana", code="INST-002", start=s, end=s + 3 * h, status=C,
      purpose="Mediciones de laboratorio de circuitos (demo)",
      history=[("est.ana", None, P, None, now - 8 * h), ("est.ana", P, C, "Ya no lo necesito", now - 7 * h)])

    # 8) ACTIVA vigente de doc.maria
    s = now - 2 * h
    L(who="doc.maria", code="INST-001", start=s, end=s + 22 * h, status=X,
      purpose="Demostración de señales en clase (demo)", approved_by_id=users["resp.carlos"].id,
      approved_at=s - 1 * d, delivered_by_id=users["resp.carlos"].id, delivered_at=s,
      checkout_condition="Con sondas y cable de poder",
      history=[("doc.maria", None, P, None, s - 2 * d), ("resp.carlos", P, A, None, s - 1 * d),
               ("resp.carlos", A, X, "Condición de salida: Con sondas y cable de poder", s)])

    # 9) DEVUELTA tarde y con daño (por eso CAM-003 está EN_REVISION)
    s = now - 20 * d
    L(who="est.luis", code="CAM-003", start=s, end=s + 1 * d, status=D,
      purpose="Cobertura del evento deportivo (demo)", approved_by_id=users["resp.carlos"].id,
      approved_at=s - 5 * h, delivered_by_id=users["resp.carlos"].id, delivered_at=s,
      checkout_condition="Con estuche y memoria", received_by_id=users["resp.carlos"].id,
      returned_at=s + 30 * h, return_condition=ItemCondition.CON_DANO, is_late=True,
      return_notes="Lente rayado; requiere revisión técnica.",
      history=[("est.luis", None, P, None, s - 1 * d), ("resp.carlos", P, A, None, s - 5 * h),
               ("resp.carlos", A, X, "Condición de salida: Con estuche y memoria", s),
               ("resp.carlos", X, D, "Devuelto con daño; el recurso pasa a EN_REVISION. Lente rayado; requiere revisión técnica.",
                s + 30 * h)])


def run() -> None:
    with SessionLocal() as db:
        users = _get_or_create_users(db)
        res = _get_or_create_catalog(db)
        _seed_loans(db, users, res)
        db.commit()
    print("Semilla aplicada.")


if __name__ == "__main__":
    run()
