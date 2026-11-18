from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.user import User
from app.schemas.common import Page
from app.schemas.resource import (
    ResourceCreate,
    ResourceDetailOut,
    ResourceOut,
    ResourceStatus,
    ResourceUpdate,
)
from app.services import resources as resource_service

router = APIRouter(prefix="/resources", tags=["Recursos"])


@router.get("", response_model=Page[ResourceOut], summary="Catálogo con disponibilidad")
def list_resources(
    category_id: int | None = None,
    q: str | None = Query(None, max_length=100),
    status: ResourceStatus | None = None,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    available_only: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Page[ResourceOut]:
    return resource_service.list_resources(
        db, user, category_id, q, status, from_, to, available_only, page, size
    )


@router.get("/{resource_id}", response_model=ResourceDetailOut, summary="Detalle y periodos ocupados")
def get_resource(
    resource_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
) -> ResourceDetailOut:
    return resource_service.get_resource_detail(db, resource_id)


@router.post("", response_model=ResourceOut, status_code=201, summary="Registrar recurso")
def create_resource(
    data: ResourceCreate, db: Session = Depends(get_db), _=Depends(require_roles("RESPONSABLE"))
) -> ResourceOut:
    return resource_service.create_resource(db, data)


@router.patch("/{resource_id}", response_model=ResourceOut, summary="Editar datos o estado operativo")
def update_resource(
    resource_id: int,
    data: ResourceUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("RESPONSABLE")),
) -> ResourceOut:
    return resource_service.update_resource(db, resource_id, data)
