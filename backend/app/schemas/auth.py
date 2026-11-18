from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["SOLICITANTE", "RESPONSABLE", "COORDINACION"]
RequesterType = Literal["ESTUDIANTE", "DOCENTE"]


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: Role
    requester_type: RequesterType | None
    institutional_id: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
