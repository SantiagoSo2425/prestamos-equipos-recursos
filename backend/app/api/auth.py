from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models.user import User
from app.schemas.auth import LoginIn, TokenOut, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# Se verifica contra un hash descartable cuando el usuario no existe, para que el tiempo
# de respuesta no revele si el usuario existe.
_DUMMY_HASH = hash_password("descartable-no-es-una-clave-real")


@router.post("/login", response_model=TokenOut, summary="Iniciar sesión")
def login(data: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.username == data.username.strip().lower()))
    valid = verify_password(data.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not valid or not user.is_active:
        raise AppError(401, "INVALID_CREDENTIALS", "Usuario o contraseña incorrectos.")
    token, expires_in = create_access_token(user.id, getattr(user.role, "value", user.role))
    return TokenOut(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut, summary="Usuario autenticado")
def me(user: User = Depends(get_current_user)) -> User:
    return user
