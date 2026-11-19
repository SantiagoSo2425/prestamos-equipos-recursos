from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models.user import User
from app.schemas.auth import Role
from app.schemas.common import Page
from app.schemas.user import UserAdminOut, UserCreate
from app.services import users as user_service

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.get("", response_model=Page[UserAdminOut], summary="Listar usuarios (solo RESPONSABLE)")
def list_users(
    role: Role | None = None,
    q: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("RESPONSABLE")),
) -> Page[UserAdminOut]:
    return user_service.list_users(db, role, q, page, size)


@router.post("", response_model=UserAdminOut, status_code=201, summary="Crear usuario (solo RESPONSABLE)")
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("RESPONSABLE")),
) -> UserAdminOut:
    return user_service.create_user(db, data)
