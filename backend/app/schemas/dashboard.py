from datetime import datetime

from pydantic import BaseModel

from app.schemas.loan import LoanOut


class SummaryOut(BaseModel):
    # ACTIVA excluye las vencidas, que se cuentan aparte como VENCIDA
    loans_by_status: dict[str, int]
    resources_by_status: dict[str, int]
    active_loans: list[LoanOut]
    overdue_loans: list[LoanOut]


class CategoryUsage(BaseModel):
    category: str
    loans: int
    hours: float


class ResourceUsage(BaseModel):
    resource_id: int
    code: str
    name: str
    loans: int
    hours: float
    last_loan_at: datetime | None


class UsageOut(BaseModel):
    by_category: list[CategoryUsage]
    by_resource: list[ResourceUsage]
