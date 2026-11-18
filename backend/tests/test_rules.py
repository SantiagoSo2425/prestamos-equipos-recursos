"""Reglas de negocio V1–V7 y máquina de estados (T089)."""
import pytest
from sqlalchemy.exc import IntegrityError

from app.domain.loan_states import assert_transition
from app.errors import AppError
from app.models import LoanStatus, RequesterType, ResourceStatus, UserRole
from app.services import rules
from tests.conftest import D, H, now


def code_of(db, user, resource, start, end, exclude=None):
    with pytest.raises(AppError) as e:
        rules.check_can_request(db, user, resource, start, end, exclude)
    return e.value.code


def test_solicitud_valida_pasa(db, make):
    ana, r = make.user(), make.resource()
    s = now() + D
    rules.check_can_request(db, ana, r, s, s + 4 * H)


def test_v1_inicio_pasado_y_fin_anterior(db, make):
    ana, r = make.user(), make.resource()
    assert code_of(db, ana, r, now() - H, now() + H) == "VALIDATION_ERROR"
    s = now() + D
    assert code_of(db, ana, r, s, s - H) == "VALIDATION_ERROR"


def test_v2_duracion_maxima_de_la_categoria(db, make):
    ana, r = make.user(), make.resource()
    s = now() + D
    assert code_of(db, ana, r, s, s + 73 * H) == "VALIDATION_ERROR"
    rules.check_can_request(db, ana, r, s, s + 72 * H)  # justo en el límite


def test_v3_recurso_no_activo(db, make):
    ana = make.user()
    s = now() + D
    for st in (ResourceStatus.EN_REVISION, ResourceStatus.DADO_DE_BAJA):
        assert code_of(db, ana, make.resource(st), s, s + H) == "RESOURCE_NOT_AVAILABLE"


def test_v4_solo_docentes(db, make):
    r = make.resource(teacher_only=True)
    s = now() + D
    est = make.user()
    doc = make.user(rtype=RequesterType.DOCENTE)
    with pytest.raises(AppError) as e:
        rules.check_can_request(db, est, r, s, s + H)
    assert (e.value.status, e.value.code) == (403, "TEACHER_ONLY")
    rules.check_can_request(db, doc, r, s, s + H)


def test_v5_vencido_bloquea(db, make):
    luis, r, otro = make.user(), make.resource(), make.resource()
    make.loan(luis, r, now() - 5 * D, now() - 2 * D, LoanStatus.ACTIVA)
    s = now() + D
    assert code_of(db, luis, otro, s, s + H) == "OVERDUE_BLOCK"


@pytest.mark.parametrize("rtype,limit", [(RequesterType.ESTUDIANTE, 2), (RequesterType.DOCENTE, 5)])
def test_v6_limite_por_tipo(db, make, rtype, limit):
    u = make.user(rtype=rtype)
    for i in range(limit):
        make.loan(u, make.resource(), now() + (i + 1) * D, now() + (i + 1) * D + H, LoanStatus.APROBADA)
    s = now() + 20 * D
    assert code_of(db, u, make.resource(), s, s + H) == "LIMIT_REACHED"


def test_v6_las_pendientes_no_cuentan(db, make):
    u = make.user()
    for i in range(3):
        make.loan(u, make.resource(), now() + (i + 1) * D, now() + (i + 1) * D + H)
    s = now() + 20 * D
    rules.check_can_request(db, u, make.resource(), s, s + H)


def test_v7_solape_y_periodos_contiguos(db, make):
    a, b, r = make.user(), make.user(), make.resource()
    s = now() + D
    make.loan(a, r, s, s + 4 * H, LoanStatus.APROBADA)
    assert code_of(db, b, r, s + 2 * H, s + 6 * H) == "OVERLAP"
    rules.check_can_request(db, b, r, s + 4 * H, s + 8 * H)  # [) : el borde no solapa
    rules.check_can_request(db, b, r, s - 2 * H, s)


def test_pendientes_no_bloquean_disponibilidad(db, make):
    a, r = make.user(), make.resource()
    s = now() + D
    make.loan(a, r, s, s + 4 * H, LoanStatus.PENDIENTE)
    assert rules.is_available(db, r.id, s, s + 4 * H)


def test_activa_vencida_ocupa_el_recurso_sin_fin(db, make):
    a, b, r = make.user(), make.user(), make.resource()
    make.loan(a, r, now() - 5 * D, now() - 2 * D, LoanStatus.ACTIVA)
    s = now() + 30 * D
    assert rules.find_overlaps(db, r.id, s, s + H)
    assert code_of(db, b, r, s, s + H) == "OVERLAP"


def test_exclude_loan_id_ignora_la_propia(db, make):
    a, r = make.user(), make.resource()
    s = now() + D
    own = make.loan(a, r, s, s + 4 * H, LoanStatus.APROBADA)
    assert rules.find_overlaps(db, r.id, s, s + 4 * H, exclude_loan_id=own.id) == []


def test_restriccion_de_bd_impide_solape_aprobado(make):
    a, b, r = make.user(), make.user(), make.resource()
    s = now() + D
    make.loan(a, r, s, s + 4 * H, LoanStatus.APROBADA)
    with pytest.raises(IntegrityError) as e:
        make.loan(b, r, s + H, s + 3 * H, LoanStatus.APROBADA)
    assert rules.translate_integrity_error(e.value).code == "OVERLAP"


class _Loan:
    """Préstamo mínimo: assert_transition solo lee estos campos."""

    def __init__(self, status, requester_id):
        self.status, self.requester_id = status, requester_id


@pytest.mark.parametrize("action,status", [
    ("approve", LoanStatus.APROBADA), ("approve", LoanStatus.ACTIVA),
    ("deliver", LoanStatus.PENDIENTE), ("return", LoanStatus.APROBADA),
    ("return", LoanStatus.DEVUELTA), ("reject", LoanStatus.ACTIVA), ("cancel", LoanStatus.ACTIVA),
])
def test_transiciones_invalidas(make, action, status):
    role = UserRole.SOLICITANTE if action == "cancel" else UserRole.RESPONSABLE
    actor = make.user(role)
    with pytest.raises(AppError) as e:
        assert_transition(_Loan(status, actor.id), action, actor)
    assert (e.value.status, e.value.code) == (409, "INVALID_TRANSITION")


def test_rol_incorrecto_es_forbidden(make):
    ana = make.user()
    with pytest.raises(AppError) as e:
        assert_transition(_Loan(LoanStatus.PENDIENTE, ana.id), "approve", ana)
    assert (e.value.status, e.value.code) == (403, "FORBIDDEN")
