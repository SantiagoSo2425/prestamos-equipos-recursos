import enum


class UserRole(str, enum.Enum):
    SOLICITANTE = "SOLICITANTE"
    RESPONSABLE = "RESPONSABLE"
    COORDINACION = "COORDINACION"


class RequesterType(str, enum.Enum):
    ESTUDIANTE = "ESTUDIANTE"
    DOCENTE = "DOCENTE"


class ResourceStatus(str, enum.Enum):
    ACTIVO = "ACTIVO"
    EN_REVISION = "EN_REVISION"
    DADO_DE_BAJA = "DADO_DE_BAJA"


class LoanStatus(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    APROBADA = "APROBADA"
    RECHAZADA = "RECHAZADA"
    CANCELADA = "CANCELADA"
    ACTIVA = "ACTIVA"
    DEVUELTA = "DEVUELTA"


class ItemCondition(str, enum.Enum):
    BUENO = "BUENO"
    CON_DANO = "CON_DANO"
