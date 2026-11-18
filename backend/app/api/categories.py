from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.schemas.resource import CategoryOut
from app.services import resources as resource_service

router = APIRouter(prefix="/categories", tags=["Recursos"])


@router.get("", response_model=list[CategoryOut], summary="Listar categorías")
def list_categories(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[CategoryOut]:
    return resource_service.list_categories(db)
