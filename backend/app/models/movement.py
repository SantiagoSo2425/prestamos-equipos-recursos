from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import LoanStatus
from app.models.user import User


class LoanMovement(Base):
    """Historial inmutable: solo se inserta (ver `services/movements.py`)."""

    __tablename__ = "loan_movements"
    __table_args__ = (Index("ix_loan_movements_loan_created", "loan_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loans.id"))
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    from_status: Mapped[LoanStatus | None] = mapped_column(Enum(LoanStatus, name="loan_status"), nullable=True)
    to_status: Mapped[LoanStatus] = mapped_column(Enum(LoanStatus, name="loan_status"))
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    actor: Mapped[User] = relationship()
