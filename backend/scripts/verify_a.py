"""Recorrido de PF-01…PF-04, PF-11, PF-13 y PF-14 (más el ciclo completo por API) contra la API y la
BD reales. Requiere `alembic upgrade head` y `python -m app.seed` sobre una BD recién sembrada.

    python -m scripts.verify_a
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import get_settings
from app.database import SessionLocal
from app.main import app

c = TestClient(app)
PW = get_settings().seed_password
FALLAS: list[str] = []


def login(u: str) -> dict:
    r = c.post("/api/auth/login", json={"username": u, "password": PW})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def sql(q: str):
    with SessionLocal() as db:
        return db.execute(text(q)).all()


def check(name, r, status, code=None, cond=None):
    j = r.json() if r.content else {}
    ok = r.status_code == status and (code is None or j.get("code") == code) and (cond is None or cond(j))
    print(("OK    " if ok else "FALLA "), f"{name:62}", r.status_code, j.get("code", "") if isinstance(j, dict) else "")
    if not ok:
        FALLAS.append(name)
        print("      ", r.text[:300])
    return r


def iso(d: datetime) -> str:
    return d.isoformat()


now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
slot = lambda days, hour=8, hours=4: (  # noqa: E731
    (now + timedelta(days=days)).replace(hour=hour),
    (now + timedelta(days=days)).replace(hour=hour) + timedelta(hours=hours),
)

ana, luis, maria = login("est.ana"), login("est.luis"), login("doc.maria")
carlos, sofia = login("resp.carlos"), login("coord.sofia")


def rid(code: str) -> int:
    return c.get("/api/resources", headers=ana, params={"q": code}).json()["items"][0]["id"]


def body(code, start, end, purpose="Práctica de laboratorio de redes"):
    return {"resource_id": rid(code), "start_at": iso(start), "end_at": iso(end), "purpose": purpose}


print("== PF-01 catálogo y disponibilidad")
r = check("catálogo sin rango: 11 visibles (oculta DADO_DE_BAJA), available null", c.get("/api/resources", headers=ana), 200,
          cond=lambda j: j["total"] == 11 and all(i["available"] is None for i in j["items"]))
check("filtro por categoría Portátil", c.get("/api/resources", headers=ana, params={"category_id": 1}), 200,
      cond=lambda j: j["total"] >= 1)
s, e = slot(1, 14, 2)  # dentro de la APROBADA de PORT-002 (semilla)
r = check("rango: PORT-002 RESERVADO, PORT-001 PRESTADO", c.get("/api/resources", headers=ana, params={"from": iso(s), "to": iso(e)}), 200,
          cond=lambda j: {i["code"]: i["unavailable_reason"] for i in j["items"]}.get("PORT-002") == "RESERVADO"
          and {i["code"]: i["unavailable_reason"] for i in j["items"]}.get("PORT-001") == "PRESTADO")
check("solo disponibles excluye ocupados", c.get("/api/resources", headers=ana, params={"from": iso(s), "to": iso(e), "available_only": "true"}), 200,
      cond=lambda j: "PORT-002" not in [i["code"] for i in j["items"]] and "PORT-001" not in [i["code"] for i in j["items"]])
check("recurso EN_REVISION/DADO_DE_BAJA: no activo", c.get("/api/resources", headers=carlos, params={"from": iso(s), "to": iso(e)}), 200,
      cond=lambda j: any(i["unavailable_reason"] == "NO_ACTIVO" for i in j["items"]))
check("detalle PORT-001: periodo vencido abierto", c.get(f"/api/resources/{rid('PORT-001')}", headers=ana), 200,
      cond=lambda j: any(b["end_at"] is None for b in j["busy_periods"]))
check("rango incompleto -> 422", c.get("/api/resources", headers=ana, params={"from": iso(s)}), 422, "VALIDATION_ERROR")

print("== PF-02 recurso inexistente")
check("GET /resources/99999 -> 404", c.get("/api/resources/99999", headers=ana), 404, "NOT_FOUND")
check("sin token -> 401", c.get("/api/resources/1"), 401, "NOT_AUTHENTICATED")

print("== PF-03 solicitud válida")
antes = sql("select count(*) from loans")[0][0]
s, e = slot(10)
r = check("crear solicitud -> 201 PENDIENTE", c.post("/api/loans", headers=ana, json=body("PORT-003", s, e)), 201,
          cond=lambda j: j["status"] == "PENDIENTE")
lid = r.json()["id"]
check("recuperable por id", c.get(f"/api/loans/{lid}", headers=ana), 200, cond=lambda j: j["resource"]["code"] == "PORT-003")
check("aparece en mis solicitudes", c.get("/api/loans", headers=ana, params={"size": 100}), 200,
      cond=lambda j: lid in [i["id"] for i in j["items"]])
check("movimiento null -> PENDIENTE", c.get(f"/api/loans/{lid}/movements", headers=ana), 200,
      cond=lambda j: len(j) == 1 and j[0]["from_status"] is None and j[0]["to_status"] == "PENDIENTE")
print("      SQL:", sql(f"select status, requester_id from loans where id={lid}"), sql(f"select count(*) from loan_movements where loan_id={lid}"))
check("ajena -> 404 (est.luis)", c.get(f"/api/loans/{lid}", headers=luis), 404, "NOT_FOUND")

print("== PF-04 solicitudes inválidas (no deben persistirse)")
antes = sql("select count(*) from loans")[0][0]
s, e = slot(11)
check("fin anterior al inicio -> 422 end_at", c.post("/api/loans", headers=ana, json=body("PORT-004", e, s)), 422,
      cond=lambda j: j["fields"][0]["field"] == "end_at")
check("propósito corto -> 422 purpose", c.post("/api/loans", headers=ana, json=body("PORT-004", s, e, "corto")), 422,
      cond=lambda j: j["fields"][0]["field"] == "purpose")
check("inicio en el pasado -> 422", c.post("/api/loans", headers=ana, json=body("PORT-004", now - timedelta(days=2), now - timedelta(days=2) + timedelta(hours=2))), 422)
check("duración > máxima -> 422", c.post("/api/loans", headers=ana, json=body("PORT-004", s, s + timedelta(days=10))), 422)
teacher = next(i for i in c.get("/api/resources", headers=ana, params={"size": 100}).json()["items"] if i["teacher_only"])
check(f"estudiante pide {teacher['code']} (solo docentes) -> 403", c.post("/api/loans", headers=ana, json=body(teacher["code"], s, e)), 403, "TEACHER_ONLY")
check("est.luis con préstamo vencido -> 409", c.post("/api/loans", headers=luis, json=body("PORT-004", s, e)), 409, "OVERDUE_BLOCK")
s2, e2 = slot(1, 15, 2)
check("solape con APROBADA -> 409 OVERLAP", c.post("/api/loans", headers=maria, json=body("PORT-002", s2, e2)), 409, "OVERLAP")
check("recurso EN_REVISION -> 409", c.post("/api/loans", headers=ana, json={**body("PORT-004", s, e), "resource_id": next(i["id"] for i in c.get("/api/resources", headers=carlos, params={"status": "EN_REVISION"}).json()["items"])}), 409, "RESOURCE_NOT_AVAILABLE")
check("responsable no crea solicitudes -> 403", c.post("/api/loans", headers=carlos, json=body("PORT-004", s, e)), 403, "FORBIDDEN")
despues = sql("select count(*) from loans")[0][0]
print(f"      SQL: loans antes={antes} después={despues} ->", "sin cambios" if antes == despues else "¡CAMBIÓ!")
if antes != despues:
    FALLAS.append("PF-04 persistió datos inválidos")
check("cancelar propia -> 200", c.post(f"/api/loans/{lid}/cancel", headers=ana, json={"note": "Ya no la necesito"}), 200,
      cond=lambda j: j["status"] == "CANCELADA")
check("cancelar de nuevo -> 409", c.post(f"/api/loans/{lid}/cancel", headers=ana, json={}), 409, "INVALID_TRANSITION")
check("cancelar ajena -> 404", c.post(f"/api/loans/{lid}/cancel", headers=luis, json={}), 404)

print("== PF-13 / PF-14 administración de recursos")
nuevo = {"code": "PORT-905", "name": "Portátil Lenovo T14", "description": "Equipo nuevo", "category_id": 1}
check("S no crea recursos -> 403", c.post("/api/resources", headers=ana, json=nuevo), 403, "FORBIDDEN")
check("R crea PORT-905 -> 201 ACTIVO", c.post("/api/resources", headers=carlos, json=nuevo), 201, cond=lambda j: j["status"] == "ACTIVO")
check("aparece en el catálogo", c.get("/api/resources", headers=ana, params={"q": "PORT-905"}), 200, cond=lambda j: j["total"] == 1)
check("código duplicado -> 409", c.post("/api/resources", headers=carlos, json=nuevo), 409, "DUPLICATE_CODE")
check("código inválido -> 422", c.post("/api/resources", headers=carlos, json={**nuevo, "code": "port-5"}), 422)
check("editar descripción", c.patch(f"/api/resources/{rid('PORT-905')}", headers=carlos, json={"description": "Editado"}), 200, cond=lambda j: j["description"] == "Editado")
check("EN_REVISION con préstamo ACTIVO -> 409", c.patch(f"/api/resources/{rid('PORT-001')}", headers=carlos, json={"status": "EN_REVISION"}), 409, "RESOURCE_IN_USE")
print("      SQL:", sql("select status from resources where code='PORT-001'"))
check("EN_REVISION de recurso libre -> 200", c.patch(f"/api/resources/{rid('PORT-905')}", headers=carlos, json={"status": "EN_REVISION"}), 200, cond=lambda j: j["status"] == "EN_REVISION")

print("== PF-11 consolidado")
r = c.get("/api/dashboard/summary", headers=sofia)
check("summary (coordinación)", r, 200)
sm = r.json()
db_loans = dict(sql("select status::text, count(*) from loans group by status"))
vencidas = sql("select count(*) from loans where status='ACTIVA' and end_at < now()")[0][0]
esperado = {k: int(v) for k, v in db_loans.items()}
esperado["ACTIVA"] = esperado.get("ACTIVA", 0) - vencidas
esperado["VENCIDA"] = vencidas
ok = all(sm["loans_by_status"].get(k, 0) == esperado.get(k, 0) for k in sm["loans_by_status"])
print("      tablero:", sm["loans_by_status"], "\n      SQL    :", esperado, "->", "COINCIDEN" if ok else "NO COINCIDEN")
if not ok:
    FALLAS.append("PF-11 totales")
res_db = {k: int(v) for k, v in sql("select status::text, count(*) from resources group by status")}
check("totales de recursos = SQL", r, 200, cond=lambda j: all(j["resources_by_status"].get(k, 0) == v for k, v in res_db.items()))
check("vencido de est.luis con días de retraso", r, 200,
      cond=lambda j: any(l["requester"]["username"] == "est.luis" and l["days_overdue"] >= 2 for l in j["overdue_loans"]))
huerfanos = sql("""select (select count(*) from loans l left join resources r on r.id=l.resource_id where r.id is null)
                        + (select count(*) from loans l left join users u on u.id=l.requester_id where u.id is null)
                        + (select count(*) from loan_movements m left join loans l on l.id=m.loan_id where l.id is null)""")[0][0]
print("      SQL: filas huérfanas =", huerfanos)
if huerfanos:
    FALLAS.append("PF-11 integridad referencial")
check("uso por categoría/recurso", c.get("/api/dashboard/usage", headers=carlos), 200,
      cond=lambda j: len(j["by_category"]) >= 1 and len(j["by_resource"]) >= 1)
check("historial filtrado VENCIDA", c.get("/api/loans", headers=sofia, params={"status": "VENCIDA"}), 200, cond=lambda j: j["total"] == vencidas)
check("historial filtrado por categoría", c.get("/api/loans", headers=sofia, params={"category_id": 1}), 200, cond=lambda j: j["total"] >= 1)
check("solicitante no ve el tablero -> 403", c.get("/api/dashboard/summary", headers=ana), 403, "FORBIDDEN")
check("coordinación no gestiona (aprobar) -> 403", c.post("/api/loans/1/approve", headers=sofia, json={}), 403, "FORBIDDEN")

print("== Ciclo completo por API (apoyo a PF-12)")
s, e = slot(20)
r = check("est.ana crea solicitud", c.post("/api/loans", headers=ana, json=body("PORT-004", s, e)), 201)
n = r.json()["id"]
check("resp.carlos aprueba", c.post(f"/api/loans/{n}/approve", headers=carlos, json={}), 200, cond=lambda j: j["status"] == "APROBADA")
check("resp.carlos entrega", c.post(f"/api/loans/{n}/deliver", headers=carlos, json={"checkout_condition": "Completo, con cargador"}), 200, cond=lambda j: j["status"] == "ACTIVA")
check("resp.carlos recibe devolución BUENO", c.post(f"/api/loans/{n}/return", headers=carlos, json={"return_condition": "BUENO"}), 200, cond=lambda j: j["status"] == "DEVUELTA")
check("4 movimientos en orden", c.get(f"/api/loans/{n}/movements", headers=sofia), 200,
      cond=lambda j: [(m["from_status"], m["to_status"]) for m in j] == [(None, "PENDIENTE"), ("PENDIENTE", "APROBADA"), ("APROBADA", "ACTIVA"), ("ACTIVA", "DEVUELTA")])

print("\nFALLAS:", FALLAS or "ninguna")
raise SystemExit(1 if FALLAS else 0)
