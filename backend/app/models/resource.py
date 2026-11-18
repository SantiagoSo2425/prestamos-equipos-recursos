from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.category import Category
from app.models.enums import ResourceStatus


class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = (
        CheckConstraint(r"code ~ '^[A-Z]{3,5}-\d{3,4}$'", name="resources_code_ck"),
        CheckConstraint("description IS NULL OR char_length(description) <= 1000", name="resources_description_ck"),
        Index("ix_resources_category_id", "category_id"),
        Index("ix_resources_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    status: Mapped[ResourceStatus] = mapped_column(
        Enum(ResourceStatus, name="resource_status"),
        default=ResourceStatus.ACTIVO,
        server_default=ResourceStatus.ACTIVO.value,
    )
    teacher_only: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[Category] = relationship()
