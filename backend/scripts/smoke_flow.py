"""Recorrido de PF-05…PF-10 contra la API y la BD reales (requiere migración + semilla)."""
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import get_settings
from app.database import SessionLocal
from app.main import app

c = TestClient(app)
PW = get_settings().seed_password


def login(u: str) -> dict:
    r = c.post("/api/auth/login", json={"username": u, "password": PW})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def loans(h, **q):
    return c.get("/api/loans", headers=h, params=q).json()["items"]


def sql(q):
    with SessionLocal() as db:
        return db.execute(text(q)).all()


def check(name, r, status, code=None):
    ok = r.status_code == status and (code is None or r.json().get("code") == code)
    print(("OK   " if ok else "FALLA"), name, "->", r.status_code, r.json().get("code", r.json().get("status")))
    if not ok:
        print("      ", r.text[:300])


resp, ana, coord = login("resp.carlos"), login("est.ana"), login("coord.sofia")
pend = sorted(loans(resp, status="PENDIENTE"), key=lambda x: x["id"])
cam = [l for l in pend if l["resource"]["code"] == "CAM-001"]
A, B = cam[0]["id"], cam[1]["id"]

print("== PF-05")
check("aprobar A", c.post(f"/api/loans/{A}/approve", headers=resp, json={}), 200)
check("aprobar B solapada", c.post(f"/api/loans/{B}/approve", headers=resp, json={}), 409, "OVERLAP")
check("rechazar sin motivo", c.post(f"/api/loans/{B}/reject", headers=resp, json={}), 422, "VALIDATION_ERROR")
check("rechazar B con motivo", c.post(f"/api/loans/{B}/reject", headers=resp, json={"reason": "Reservado para otra actividad"}), 200)
check("aprobar A de nuevo", c.post(f"/api/loans/{A}/approve", headers=resp, json={}), 409, "INVALID_TRANSITION")
print(sql(f"select loan_id,from_status,to_status,note from loan_movements where loan_id in ({A},{B}) order by id"))

print("== PF-06")
check("S aprueba", c.post(f"/api/loans/{A}/approve", headers=ana, json={}), 403, "FORBIDDEN")
check("C aprueba", c.post(f"/api/loans/{A}/approve", headers=coord, json={}), 403, "FORBIDDEN")
check("sin token", c.post(f"/api/loans/{A}/approve", json={}), 401, "NOT_AUTHENTICATED")

print("== PF-07/08")
check("entregar PENDIENTE", c.post(f"/api/loans/{B}/deliver", headers=resp, json={"checkout_condition": "x"}), 409, "INVALID_TRANSITION")
check("entregar sin condición", c.post(f"/api/loans/{A}/deliver", headers=resp, json={}), 422, "VALIDATION_ERROR")
r = c.post(f"/api/loans/{A}/deliver", headers=resp, json={"checkout_condition": "Completo, con estuche"})
check("entregar A", r, 200)
print("   ", r.json()["status"], r.json()["delivered_by"]["username"], r.json()["checkout_condition"])

print("== PF-09")
print("   ACTIVA:", [(l["id"], l["resource"]["code"]) for l in loans(resp, status="ACTIVA")])
print("   VENCIDA:", [(l["id"], l["resource"]["code"], l["days_overdue"]) for l in loans(resp, status="VENCIDA")])

print("== PF-10")
check("devolver CON_DANO sin notas", c.post(f"/api/loans/{A}/return", headers=resp, json={"return_condition": "CON_DANO"}), 422, "VALIDATION_ERROR")
r = c.post(f"/api/loans/{A}/return", headers=resp, json={"return_condition": "CON_DANO", "return_notes": "Lente rayado"})
check("devolver CON_DANO", r, 200)
print("   ", r.json()["status"], "is_late =", r.json()["is_late"])
print("   recurso:", sql("select code,status from resources where code='CAM-001'"))
check("devolver de nuevo", c.post(f"/api/loans/{A}/return", headers=resp, json={"return_condition": "BUENO"}), 409, "INVALID_TRANSITION")
for m in sql(f"select from_status,to_status,note from loan_movements where loan_id={A} order by id"):
    print("   ", m)

print("== Recurso EN_REVISION no se entrega / vencida devuelta")
venc = loans(resp, status="VENCIDA")[0]["id"]
check("devolver vencida BUENO", c.post(f"/api/loans/{venc}/return", headers=resp, json={"return_condition": "BUENO"}), 200)
print("   is_late:", sql(f"select is_late from loans where id={venc}"))
