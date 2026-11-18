"""Matriz rol × endpoint de contracts/api.md (T090).

Requiere la BD migrada y sembrada (`alembic upgrade head` + `python -m app.seed`) y las variables de
entorno de `backend/.env`. Solo comprueba *quién puede* llamar a cada endpoint (401/403) y el
aislamiento de solicitudes ajenas (404); no modifica datos porque las llamadas permitidas usan ids
inexistentes (404 en lugar de 2xx) o son de solo lectura.

    python -m pytest tests/test_permissions.py -q
"""
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

client = TestClient(app)
PASSWORD = get_settings().seed_password
ROLE_USERS = {"S": "est.ana", "R": "resp.carlos", "C": "coord.sofia"}
MISSING = 99_999_999  # id que no existe: una llamada autorizada termina en 404, nunca modifica datos


def _headers(role: str) -> dict:
    r = client.post("/api/auth/login", json={"username": ROLE_USERS[role], "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


HEADERS = {}


@pytest.fixture(scope="module", autouse=True)
def _tokens():
    for role in ROLE_USERS:
        HEADERS[role] = _headers(role)


# (método, ruta, cuerpo, roles autorizados)
ENDPOINTS = [
    ("GET", "/api/auth/me", None, "SRC"),
    ("GET", "/api/categories", None, "SRC"),
    ("GET", "/api/resources", None, "SRC"),
    ("GET", f"/api/resources/{MISSING}", None, "SRC"),
    ("POST", "/api/resources", {"code": "bad", "name": "x", "category_id": 1}, "R"),
    ("PATCH", f"/api/resources/{MISSING}", {"name": "x"}, "R"),
    ("POST", "/api/loans", {"resource_id": MISSING, "start_at": "2999-01-01T08:00:00Z",
                            "end_at": "2999-01-01T10:00:00Z", "purpose": "Prueba de permisos del sistema"}, "S"),
    ("GET", "/api/loans", None, "SRC"),
    ("GET", f"/api/loans/{MISSING}", None, "SRC"),
    ("POST", f"/api/loans/{MISSING}/cancel", {}, "S"),
    ("GET", f"/api/loans/{MISSING}/movements", None, "SRC"),
    ("POST", f"/api/loans/{MISSING}/approve", {}, "R"),
    ("POST", f"/api/loans/{MISSING}/reject", {"reason": "Motivo de prueba"}, "R"),
    ("POST", f"/api/loans/{MISSING}/deliver", {"checkout_condition": "Completo"}, "R"),
    ("POST", f"/api/loans/{MISSING}/return", {"return_condition": "BUENO"}, "R"),
    ("GET", "/api/dashboard/summary", None, "RC"),
    ("GET", "/api/dashboard/usage", None, "RC"),
]


@pytest.mark.parametrize("method,path,body,allowed", ENDPOINTS)
def test_sin_token_es_401(method, path, body, allowed):
    r = client.request(method, path, json=body)
    assert r.status_code == 401
    assert r.json()["code"] == "NOT_AUTHENTICATED"


@pytest.mark.parametrize("method,path,body,allowed", ENDPOINTS)
@pytest.mark.parametrize("role", ["S", "R", "C"])
def test_matriz_de_roles(role, method, path, body, allowed):
    r = client.request(method, path, json=body, headers=HEADERS[role])
    if role in allowed:
        assert r.status_code not in (401, 403), f"{role} debería poder llamar {method} {path}: {r.text}"
    else:
        assert r.status_code == 403, f"{role} no debería poder llamar {method} {path}: {r.text}"
        assert r.json()["code"] == "FORBIDDEN"


def test_solicitante_no_ve_solicitudes_ajenas():
    """Un SOLICITANTE solo lista las suyas y recibe 404 (no 403) al pedir la de otro."""
    otra = client.get("/api/loans", headers=HEADERS["R"], params={"size": 100}).json()["items"]
    ajena = next(x for x in otra if x["requester"]["username"] != ROLE_USERS["S"])
    propias = client.get("/api/loans", headers=HEADERS["S"], params={"size": 100}).json()["items"]
    assert all(x["requester"]["username"] == ROLE_USERS["S"] for x in propias)
    for path in (f"/api/loans/{ajena['id']}", f"/api/loans/{ajena['id']}/movements"):
        assert client.get(path, headers=HEADERS["S"]).status_code == 404
    assert client.post(f"/api/loans/{ajena['id']}/cancel", headers=HEADERS["S"], json={}).status_code == 404


def test_token_invalido_es_401():
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer no-es-un-jwt"})
    assert r.status_code == 401


def test_login_no_revela_si_existe_el_usuario():
    a = client.post("/api/auth/login", json={"username": "no.existe", "password": "x"})
    b = client.post("/api/auth/login", json={"username": ROLE_USERS["S"], "password": "incorrecta"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()
