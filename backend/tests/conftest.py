"""Fixtures de pruebas: BD PostgreSQL real (la restricción EXCLUDE no existe en SQLite).

Usa `TEST_DATABASE_URL` (el nombre de la base debe terminar en `_test`; se recrea el
esquema en cada ejecución). Cada prueba parte de tablas vacías y crea sus propios datos.
"""
import os
from datetime import datetime, timedelta, timezone
from itertools import count
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

TEST_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://prestamos:localdev123@localhost:5432/prestamos_test"
)
if not TEST_URL.split("?")[0].endswith("_test"):
    raise RuntimeError("TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en '_test'.")
os.environ["DATABASE_URL"] = TEST_URL
os.environ.setdefault("JWT_SECRET", "secreto-solo-para-pruebas")
os.environ.setdefault("SEED_PASSWORD", "Prueba1234!")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Category, Loan, LoanStatus, RequesterType, Resource, ResourceStatus, User, UserRole,
)
from app.security import create_access_token, hash_password  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

H = timedelta(hours=1)
D = timedelta(days=1)


def now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


@pytest.fixture(scope="session", autouse=True)
def _schema():
    with create_engine(TEST_URL, isolation_level="AUTOCOMMIT").connect() as c:
        c.execute(text("DROP SCHEMA public CASCADE"))
        c.execute(text("CREATE SCHEMA public"))
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    command.upgrade(cfg, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean():
    with engine.begin() as c:
        c.execute(text(
            "TRUNCATE loan_movements, loans, resources, categories, users RESTART IDENTITY CASCADE"
        ))


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


@pytest.fixture
def client():
    return TestClient(app)


_n = count(1)


class Factory:
    """Crea datos mínimos y los confirma en la BD."""

    def __init__(self, db):
        self.db = db
        self.category = Category(name="Portátil", max_loan_hours=72)
        db.add(self.category)
        db.commit()

    def user(self, role=UserRole.SOLICITANTE, rtype=RequesterType.ESTUDIANTE) -> User:
        i = next(_n)
        u = User(
            username=f"user.{i}", full_name=f"Usuario {i}", institutional_id=f"X{i:04d}",
            password_hash=hash_password("x"), role=role,
            requester_type=rtype if role == UserRole.SOLICITANTE else None,
        )
        self.db.add(u)
        self.db.commit()
        return u

    def manager(self) -> User:
        return self.user(UserRole.RESPONSABLE)

    def resource(self, status=ResourceStatus.ACTIVO, teacher_only=False) -> Resource:
        i = next(_n)
        r = Resource(
            code=f"PORT-{i:03d}", name=f"Portátil {i}", category_id=self.category.id,
            status=status, teacher_only=teacher_only,
        )
        self.db.add(r)
        self.db.commit()
        return r

    def loan(self, requester, resource, start, end, status=LoanStatus.PENDIENTE, **extra) -> Loan:
        if status in (LoanStatus.ACTIVA, LoanStatus.DEVUELTA):
            extra.setdefault("delivered_at", start)
        loan = Loan(
            resource_id=resource.id, requester_id=requester.id, start_at=start, end_at=end,
            purpose="Práctica de laboratorio de redes", status=status, **extra,
        )
        self.db.add(loan)
        self.db.commit()
        return loan


@pytest.fixture
def make(db) -> Factory:
    return Factory(db)


def auth(user: User) -> dict:
    token, _ = create_access_token(user.id, user.role.value)
    return {"Authorization": f"Bearer {token}"}
