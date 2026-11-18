from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import UserRef
from app.schemas.loan import LoanStatus


class MovementOut(BaseModel):
    id: int
    actor: UserRef
    from_status: LoanStatus | None
    to_status: LoanStatus
    note: str | None
    created_at: datetime
