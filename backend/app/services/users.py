"""Administración de usuarios: alta y consulta, solo para el RESPONSABLE."""
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models.user import User
from app.schemas.common import Page
from app.schemas.user import UserAdminOut, UserCreate
from app.security import hash_password


def list_users(db: Session, role: str | None, q: str | None, page: int, size: int) -> Page[UserAdminOut]:
    conds = []
    if role:
        conds.append(User.role == role)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        conds.append(
            or_(
                func.lower(User.username).like(like),
                func.lower(User.full_name).like(like),
                func.lower(User.institutional_id).like(like),
            )
        )
    total = db.scalar(select(func.count()).select_from(User).where(*conds)) or 0
    rows = db.scalars(
        select(User).where(*conds).order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * size).limit(size)
    ).all()
    return Page(items=[UserAdminOut.model_validate(u) for u in rows], total=total, page=page, size=size)


def _duplicado(message: str, code: str) -> AppError:
    return AppError(409, code, message)


def create_user(db: Session, data: UserCreate) -> UserAdminOut:
    if db.scalar(select(User.id).where(User.username == data.username)) is not None:
        raise _duplicado(f"Ya existe un usuario con el nombre «{data.username}».", "DUPLICATE_USERNAME")
    if db.scalar(select(User.id).where(User.institutional_id == data.institutional_id)) is not None:
        raise _duplicado(
            f"Ya existe un usuario con el código institucional {data.institutional_id}.",
            "DUPLICATE_INSTITUTIONAL_ID",
        )
    user = User(
        username=data.username,
        full_name=data.full_name,
        institutional_id=data.institutional_id,
        password_hash=hash_password(data.password),
        role=data.role,
        requester_type=data.requester_type,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:  # carrera entre dos altas con los mismos datos
        db.rollback()
        raise AppError(409, "DUPLICATE_USER", "Ya existe un usuario con esos datos.")
    return UserAdminOut.model_validate(user)
