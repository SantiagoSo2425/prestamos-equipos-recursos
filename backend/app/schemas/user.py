from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.auth import RequesterType, Role


class UserCreate(BaseModel):
    username: str = Field(pattern=r"^[a-z0-9._]{3,50}$")
    full_name: str = Field(min_length=3, max_length=120)
    institutional_id: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    role: Role
    requester_type: RequesterType | None = None

    @field_validator("full_name", "institutional_id")
    @classmethod
    def _sin_espacios(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Este campo no puede estar vacío.")
        return v

    @model_validator(mode="after")
    def _tipo_segun_rol(self) -> "UserCreate":
        if self.role == "SOLICITANTE" and self.requester_type is None:
            raise ValueError("Indica si el solicitante es ESTUDIANTE o DOCENTE.")
        if self.role != "SOLICITANTE" and self.requester_type is not None:
            raise ValueError("Solo los solicitantes tienen tipo (ESTUDIANTE o DOCENTE).")
        return self


class UserAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    institutional_id: str
    role: Role
    requester_type: RequesterType | None
    is_active: bool
    created_at: datetime

