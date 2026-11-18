from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ItemCondition, LoanStatus
from app.models.resource import Resource
from app.models.user import User


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (
        CheckConstraint("end_at > start_at", name="loans_period_ck"),
        CheckConstraint("char_length(purpose) >= 10", name="loans_purpose_ck"),
        CheckConstraint("status <> 'RECHAZADA' OR rejection_reason IS NOT NULL", name="loans_rejection_ck"),
        CheckConstraint(
            "status NOT IN ('ACTIVA','DEVUELTA') OR delivered_at IS NOT NULL", name="loans_delivered_ck"
        ),
        CheckConstraint(
            "status <> 'DEVUELTA' OR (returned_at IS NOT NULL AND return_condition IS NOT NULL)",
            name="loans_returned_ck",
        ),
        # Un recurso no puede tener dos préstamos APROBADA/ACTIVA con periodos solapados.
        ExcludeConstraint(
            ("resource_id", "="),
            (func.tstzrange(text("start_at"), text("end_at"), "[)"), "&&"),
            where=text("status IN ('APROBADA','ACTIVA')"),
            using="gist",
            name="loans_no_overlap",
        ),
        Index("ix_loans_resource_status", "resource_id", "status"),
        Index("ix_loans_requester_status", "requester_id", "status"),
        Index("ix_loans_status_end", "status", "end_at"),
        Index("ix_loans_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id"))
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    purpose: Mapped[str] = mapped_column(String(500))
    status: Mapped[LoanStatus] = mapped_column(
        Enum(LoanStatus, name="loan_status"),
        default=LoanStatus.PENDIENTE,
        server_default=LoanStatus.PENDIENTE.value,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checkout_condition: Mapped[str | None] = mapped_column(String(500), nullable=True)
    received_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    return_condition: Mapped[ItemCondition | None] = mapped_column(
        Enum(ItemCondition, name="item_condition"), nullable=True
    )
    return_notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_late: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    resource: Mapped[Resource] = relationship()
    requester: Mapped[User] = relationship(foreign_keys=[requester_id])
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_id])
    delivered_by: Mapped[User | None] = relationship(foreign_keys=[delivered_by_id])
    received_by: Mapped[User | None] = relationship(foreign_keys=[received_by_id])

    @property
    def effective_status(self) -> str:
        """`VENCIDA` si está ACTIVA y ya pasó `end_at`; en otro caso, el estado almacenado."""
        status = self.status.value if isinstance(self.status, LoanStatus) else self.status
        if status == "ACTIVA" and self.end_at < datetime.now(timezone.utc):
            return "VENCIDA"
        return status
