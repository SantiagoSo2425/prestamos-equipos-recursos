from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.errors import AppError

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd.verify(password, password_hash)


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    """Devuelve `(token, expires_in_segundos)`."""
    settings = get_settings()
    expires_in = settings.jwt_expire_minutes * 60
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM), expires_in


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AppError(401, "TOKEN_EXPIRED", "La sesión ha expirado. Inicia sesión de nuevo.")
    except jwt.InvalidTokenError:
        raise AppError(401, "NOT_AUTHENTICATED", "Credenciales no válidas.")
