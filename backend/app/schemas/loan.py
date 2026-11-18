"""Esquemas de préstamos.

Sección A (Santiago): salida `LoanOut` y filtros de consulta.
Sección B: esquemas de acciones (`ApproveIn`, `RejectIn`, `DeliverIn`, `ReturnIn`) — agregar al final.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from app.schemas.auth import RequesterType
from app.schemas.common import UserRef

LoanStatus = Literal["PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA", "ACTIVA", "DEVUELTA"]
EffectiveStatus = Literal[
    "PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA", "ACTIVA", "DEVUELTA", "VENCIDA"
]
Condition = Literal["BUENO", "CON_DANO"]


class LoanResourceRef(BaseModel):
    id: int
    code: str
    name: str
    category: str


class LoanRequesterRef(UserRef):
    requester_type: RequesterType


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource: LoanResourceRef
    requester: LoanRequesterRef
    start_at: datetime
    end_at: datetime
    purpose: str
    status: LoanStatus
    effective_status: EffectiveStatus
    rejection_reason: str | None
    approved_by: UserRef | None
    approved_at: datetime | None
    delivered_by: UserRef | None
    delivered_at: datetime | None
    checkout_condition: str | None
    received_by: UserRef | None
    returned_at: datetime | None
    return_condition: Condition | None
    return_notes: str | None
    is_late: bool
    days_overdue: int
    created_at: datetime
    updated_at: datetime


class LoanFilters(BaseModel):
    status: EffectiveStatus | None = None
    resource_id: int | None = None
    category_id: int | None = None
    requester_id: int | None = None
    from_: datetime | None = None
    to: datetime | None = None
    page: int = 1
    size: int = 20
    sort: Literal["-created_at", "created_at", "-start_at", "start_at"] = "-created_at"


class LoanCreate(BaseModel):
    resource_id: int
    start_at: datetime
    end_at: datetime
    purpose: str = Field(min_length=10, max_length=500)

    @field_validator("purpose")
    @classmethod
    def _purpose_trim(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("El propósito debe tener al menos 10 caracteres.")
        return v

    @field_validator("start_at", "end_at")
    @classmethod
    def _con_zona(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("Debe incluir zona horaria (ej. 2026-11-20T08:00:00-05:00).")
        return v

    @field_validator("end_at")
    @classmethod
    def _fin_posterior(cls, v: datetime, info: ValidationInfo) -> datetime:
        start = info.data.get("start_at")
        if start is not None and v <= start:
            raise ValueError("Debe ser posterior a la fecha de inicio.")
        return v


class CancelIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)
