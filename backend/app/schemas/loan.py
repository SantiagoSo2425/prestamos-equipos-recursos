"""Esquemas de préstamos.

Sección A (Santiago): salida `LoanOut` y filtros de consulta.
Sección B: esquemas de acciones (`ApproveIn`, `RejectIn`, `DeliverIn`, `ReturnIn`) — agregar al final.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


# ---------------------------------------------------------------- Sección B
def _aware(v: datetime | None) -> datetime | None:
    if v is not None and v.tzinfo is None:
        raise ValueError("Incluye la zona horaria (por ejemplo, -05:00).")
    return v


class ApproveIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class RejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("reason")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("El motivo debe tener al menos 5 caracteres.")
        return v


class DeliverIn(BaseModel):
    delivered_at: datetime | None = None
    checkout_condition: str = Field(min_length=1, max_length=500)

    @field_validator("delivered_at")
    @classmethod
    def _tz(cls, v: datetime | None) -> datetime | None:
        return _aware(v)

    @field_validator("checkout_condition")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Describe la condición del recurso al salir.")
        return v


class ReturnIn(BaseModel):
    returned_at: datetime | None = None
    return_condition: Condition
    return_notes: str | None = Field(default=None, max_length=1000, validate_default=True)

    @field_validator("returned_at")
    @classmethod
    def _tz(cls, v: datetime | None) -> datetime | None:
        return _aware(v)

    @field_validator("return_notes")
    @classmethod
    def _notes_if_damage(cls, v: str | None, info) -> str | None:
        v = v.strip() if v else None
        if info.data.get("return_condition") == "CON_DANO" and not v:
            raise ValueError("Las observaciones son obligatorias cuando el recurso vuelve con daño.")
        return v or None
