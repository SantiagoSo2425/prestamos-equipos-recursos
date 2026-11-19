"""Administración de usuarios: solo el RESPONSABLE los crea y consulta."""
from app.models import User, UserRole
from app.security import verify_password
from tests.conftest import auth

NUEVO = {
    "username": "est.nuevo",
    "full_name": "Estudiante Nuevo",
    "institutional_id": "E9001",
    "password": "ClaveSegura1",
    "role": "SOLICITANTE",
    "requester_type": "ESTUDIANTE",
}


def test_responsable_crea_usuario_y_este_puede_iniciar_sesion(client, db, make):
    resp = make.manager()
    r = client.post("/api/users", headers=auth(resp), json=NUEVO)
    assert r.status_code == 201
    body = r.json()
    assert body["username"] == "est.nuevo" and body["role"] == "SOLICITANTE" and body["is_active"] is True
    assert "password" not in body and "password_hash" not in body

    db.expire_all()
    u = db.query(User).filter_by(username="est.nuevo").one()
    assert u.password_hash != "ClaveSegura1" and verify_password("ClaveSegura1", u.password_hash)

    login = client.post("/api/auth/login", json={"username": "est.nuevo", "password": "ClaveSegura1"})
    assert login.status_code == 200 and login.json()["user"]["requester_type"] == "ESTUDIANTE"


def test_crear_responsable_y_coordinacion_sin_tipo(client, make):
    h = auth(make.manager())
    for i, role in enumerate(("RESPONSABLE", "COORDINACION")):
        body = {**NUEVO, "username": f"otro.{i}", "institutional_id": f"Z{i}", "role": role, "requester_type": None}
        assert client.post("/api/users", headers=h, json=body).status_code == 201


def test_solicitante_y_coordinacion_no_pueden_crear_ni_listar(client, db, make):
    ana = make.user()
    coord = make.user(UserRole.COORDINACION)
    for u in (ana, coord):
        assert client.post("/api/users", headers=auth(u), json=NUEVO).status_code == 403
        assert client.get("/api/users", headers=auth(u)).status_code == 403
    assert db.query(User).filter_by(username="est.nuevo").count() == 0


def test_sin_sesion_responde_401(client):
    assert client.post("/api/users", json=NUEVO).status_code == 401
    assert client.get("/api/users").status_code == 401


def test_usuario_duplicado_y_codigo_duplicado(client, db, make):
    h = auth(make.manager())
    assert client.post("/api/users", headers=h, json=NUEVO).status_code == 201
    dup = client.post("/api/users", headers=h, json={**NUEVO, "institutional_id": "OTRO1"})
    assert dup.status_code == 409 and dup.json()["code"] == "DUPLICATE_USERNAME"
    cod = client.post("/api/users", headers=h, json={**NUEVO, "username": "otro.usuario"})
    assert cod.status_code == 409 and cod.json()["code"] == "DUPLICATE_INSTITUTIONAL_ID"
    assert db.query(User).filter(User.username.in_(["est.nuevo", "otro.usuario"])).count() == 1


def test_datos_invalidos_responden_422_sin_crear(client, db, make):
    h = auth(make.manager())
    antes = db.query(User).count()
    casos = [
        {**NUEVO, "username": "Con Espacios"},
        {**NUEVO, "username": "ab"},
        {**NUEVO, "password": "corta"},
        {**NUEVO, "full_name": "  "},
        {**NUEVO, "requester_type": None},                      # solicitante sin tipo
        {**NUEVO, "role": "RESPONSABLE"},                      # responsable con tipo
        {**NUEVO, "role": "ADMIN", "requester_type": None},     # rol inexistente
    ]
    for body in casos:
        r = client.post("/api/users", headers=h, json=body)
        assert r.status_code == 422 and r.json()["code"] == "VALIDATION_ERROR", body
    assert db.query(User).count() == antes


def test_listar_con_filtros_y_sin_exponer_claves(client, make):
    resp = make.manager()
    make.user(), make.user(UserRole.COORDINACION)
    h = auth(resp)
    todos = client.get("/api/users", headers=h).json()
    assert todos["total"] == 3 and all("password_hash" not in u for u in todos["items"])
    sol = client.get("/api/users", headers=h, params={"role": "SOLICITANTE"}).json()
    assert sol["total"] == 1
    assert client.get("/api/users", headers=h, params={"q": "no-existe"}).json()["total"] == 0
