from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ResourceStatus = Literal["ACTIVO", "EN_REVISION", "DADO_DE_BAJA"]
UnavailableReason = Literal["PRESTADO", "RESERVADO", "NO_ACTIVO"]
BusyStatus = Literal["APROBADA", "ACTIVA"]


class CategoryOut(BaseModel):
    id: int
    name: str
    max_loan_hours: int


class ResourceOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    category: CategoryOut
    status: ResourceStatus
    teacher_only: bool
    available: bool | None  # null si no se envió rango from/to
    unavailable_reason: UnavailableReason | None


class BusyPeriod(BaseModel):
    loan_id: int
    start_at: datetime
    end_at: datetime | None  # null = préstamo vencido sin devolver (ocupación abierta)
    status: BusyStatus


class ResourceDetailOut(ResourceOut):
    busy_periods: list[BusyPeriod]


# ---------------------------------------------------------------- Administración (US7)
class ResourceCreate(BaseModel):
    code: str = Field(pattern=r"^[A-Z]{3,5}-\d{3,4}$")
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    category_id: int
    teacher_only: bool = False

    @field_validator("name")
    @classmethod
    def _name_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío.")
        return v


class ResourceUpdate(BaseModel):
    """Edición parcial: solo se aplican los campos enviados. `code` no es editable."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    category_id: int | None = None
    teacher_only: bool | None = None
    status: ResourceStatus | None = None
    # `name`, `category_id`, `teacher_only` y `status` pueden omitirse pero no enviarse
    # como null: lo valida el servicio (`update_resource`).
