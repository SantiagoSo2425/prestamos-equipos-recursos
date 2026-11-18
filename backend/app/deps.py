from collections.abc import Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError
from app.models.user import User
from app.security import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Exige un Bearer válido y devuelve el usuario activo."""
    if creds is None:
        raise AppError(401, "NOT_AUTHENTICATED", "Debes iniciar sesión.")
    payload = decode_token(creds.credentials)
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise AppError(401, "NOT_AUTHENTICATED", "Credenciales no válidas.")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(401, "NOT_AUTHENTICATED", "Credenciales no válidas.")
    return user


def require_roles(*roles: str) -> Callable[..., User]:
    """Dependencia que permite el acceso solo a los roles indicados (403 `FORBIDDEN`)."""
    allowed = {getattr(r, "value", r) for r in roles}

    def _checker(user: User = Depends(get_current_user)) -> User:
        if getattr(user.role, "value", user.role) not in allowed:
            raise AppError(403, "FORBIDDEN", "No tienes permiso para realizar esta acción.")
        return user

    return _checker
