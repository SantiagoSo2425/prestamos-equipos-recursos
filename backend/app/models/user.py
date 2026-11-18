from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import RequesterType, UserRole


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("(role = 'SOLICITANTE') = (requester_type IS NOT NULL)", name="users_requester_type_ck"),
        CheckConstraint("username ~ '^[a-z0-9._]{3,50}$'", name="users_username_ck"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    full_name: Mapped[str] = mapped_column(String(120))
    institutional_id: Mapped[str] = mapped_column(String(20), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"))
    requester_type: Mapped[RequesterType | None] = mapped_column(
        Enum(RequesterType, name="requester_type"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
