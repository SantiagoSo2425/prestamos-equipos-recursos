"""Flujo aprobar → entregar → devolver por la API, permisos y concurrencia."""
import threading

from app.database import SessionLocal
from app.errors import AppError
from app.models import LoanMovement, LoanStatus, Resource, ResourceStatus, User, UserRole
from app.schemas.loan import ApproveIn
from app.services import loan_workflow
from tests.conftest import D, H, auth, now


def test_ciclo_completo_con_historial(client, db, make):
    ana, resp = make.user(), make.manager()
    s = now() + D
    loan = make.loan(ana, make.resource(), s, s + 4 * H)
    hr = auth(resp)

    assert client.post(f"/api/loans/{loan.id}/approve", headers=hr, json={}).json()["status"] == "APROBADA"
    d = client.post(f"/api/loans/{loan.id}/deliver", headers=hr, json={"checkout_condition": "Completo"})
    assert d.status_code == 200 and d.json()["status"] == "ACTIVA"
    assert d.json()["delivered_by"]["id"] == resp.id
    ret = client.post(f"/api/loans/{loan.id}/return", headers=hr, json={"return_condition": "BUENO"})
    assert ret.status_code == 200 and ret.json()["status"] == "DEVUELTA"

    db.expire_all()
    steps = [
        (m.from_status, m.to_status)
        for m in db.query(LoanMovement).filter_by(loan_id=loan.id).order_by(LoanMovement.id)
    ]
    assert steps == [
        (LoanStatus.PENDIENTE, LoanStatus.APROBADA),
        (LoanStatus.APROBADA, LoanStatus.ACTIVA),
        (LoanStatus.ACTIVA, LoanStatus.DEVUELTA),
    ]


def test_devolucion_con_dano_pasa_recurso_a_revision(client, db, make):
    ana, resp = make.user(), make.manager()
    r = make.resource()
    loan = make.loan(ana, r, now() - 2 * H, now() + 2 * H, LoanStatus.ACTIVA)
    url = f"/api/loans/{loan.id}/return"
    sin_notas = client.post(url, headers=auth(resp), json={"return_condition": "CON_DANO"})
    assert sin_notas.status_code == 422 and sin_notas.json()["fields"][0]["field"] == "return_notes"
    ok = client.post(
        url, headers=auth(resp), json={"return_condition": "CON_DANO", "return_notes": "Pantalla rota"}
    )
    assert ok.status_code == 200
    db.expire_all()
    assert db.get(Resource, r.id).status == ResourceStatus.EN_REVISION


def test_devolucion_tardia_marca_is_late(client, make):
    ana, resp = make.user(), make.manager()
    loan = make.loan(ana, make.resource(), now() - 5 * D, now() - 2 * D, LoanStatus.ACTIVA)
    r = client.post(f"/api/loans/{loan.id}/return", headers=auth(resp), json={"return_condition": "BUENO"})
    assert r.status_code == 200 and r.json()["is_late"] is True


def test_rechazo_exige_motivo(client, make):
    ana, resp = make.user(), make.manager()
    s = now() + D
    loan = make.loan(ana, make.resource(), s, s + H)
    assert client.post(f"/api/loans/{loan.id}/reject", headers=auth(resp), json={}).status_code == 422
    r = client.post(f"/api/loans/{loan.id}/reject", headers=auth(resp), json={"reason": "No disponible"})
    assert r.status_code == 200 and r.json()["rejection_reason"] == "No disponible"


def test_aprobar_inicio_pasado_es_start_passed(client, make):
    ana, resp = make.user(), make.manager()
    loan = make.loan(ana, make.resource(), now() - H, now() + H)
    r = client.post(f"/api/loans/{loan.id}/approve", headers=auth(resp), json={})
    assert (r.status_code, r.json()["code"]) == (409, "START_PASSED")


def test_aprobar_solapada_es_overlap(client, make):
    a, b, resp = make.user(), make.user(), make.manager()
    res = make.resource()
    s = now() + D
    make.loan(a, res, s, s + 4 * H, LoanStatus.APROBADA)
    otra = make.loan(b, res, s + H, s + 3 * H)
    r = client.post(f"/api/loans/{otra.id}/approve", headers=auth(resp), json={})
    assert (r.status_code, r.json()["code"]) == (409, "OVERLAP")


def test_entregar_recurso_en_revision_o_ya_entregado(client, make):
    a, b, resp = make.user(), make.user(), make.manager()
    s = now() + D
    l1 = make.loan(a, make.resource(ResourceStatus.EN_REVISION), s, s + H, LoanStatus.APROBADA)
    r1 = client.post(f"/api/loans/{l1.id}/deliver", headers=auth(resp), json={"checkout_condition": "ok"})
    assert (r1.status_code, r1.json()["code"]) == (409, "RESOURCE_NOT_AVAILABLE")

    res = make.resource()
    make.loan(a, res, now() - H, now() + H, LoanStatus.ACTIVA)
    l2 = make.loan(b, res, now() + 2 * H, now() + 3 * H, LoanStatus.APROBADA)
    r2 = client.post(f"/api/loans/{l2.id}/deliver", headers=auth(resp), json={"checkout_condition": "ok"})
    assert (r2.status_code, r2.json()["code"]) == (409, "RESOURCE_NOT_AVAILABLE")


def test_permisos_por_rol(client, make):
    ana, coord, resp = make.user(), make.user(UserRole.COORDINACION), make.manager()
    s = now() + D
    loan = make.loan(ana, make.resource(), s, s + H)
    acciones = [
        ("approve", {}), ("reject", {"reason": "motivo válido"}),
        ("deliver", {"checkout_condition": "x"}), ("return", {"return_condition": "BUENO"}),
    ]
    for action, body in acciones:
        url = f"/api/loans/{loan.id}/{action}"
        assert client.post(url, headers=auth(ana), json=body).status_code == 403
        assert client.post(url, headers=auth(coord), json=body).status_code == 403
        assert client.post(url, json=body).status_code == 401
    assert client.post("/api/loans/99999/approve", headers=auth(resp), json={}).status_code == 404


def test_aprobacion_concurrente_solo_una_gana(make):
    a, b, resp = make.user(), make.user(), make.manager()
    res = make.resource()
    s = now() + D
    l1 = make.loan(a, res, s, s + 4 * H)
    l2 = make.loan(b, res, s + H, s + 5 * H)
    barrier = threading.Barrier(2)
    results: dict[int, str] = {}

    def run(loan_id: int) -> None:
        with SessionLocal() as session:
            actor = session.get(User, resp.id)
            barrier.wait()
            try:
                loan_workflow.approve_loan(session, actor, loan_id, ApproveIn())
                session.commit()
                results[loan_id] = "OK"
            except AppError as e:
                session.rollback()
                results[loan_id] = e.code

    threads = [threading.Thread(target=run, args=(i,)) for i in (l1.id, l2.id)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results.values()) == ["OK", "OVERLAP"]
