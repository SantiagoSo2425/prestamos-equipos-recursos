import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("prestamos")


class AppError(Exception):
    """Error de negocio con formato uniforme `{detail, code, fields?}`."""

    def __init__(self, status: int, code: str, detail: str, fields: list[dict] | None = None):
        super().__init__(detail)
        self.status = status
        self.code = code
        self.detail = detail
        self.fields = fields


def _body(detail: str, code: str, fields: list[dict] | None = None) -> dict:
    body: dict = {"detail": detail, "code": code}
    if fields:
        body["fields"] = fields
    return body


_MENSAJES = {
    "missing": "Este campo es obligatorio.",
    "string_too_short": "Es demasiado corto.",
    "string_too_long": "Es demasiado largo.",
    "string_type": "Debe ser un texto.",
    "int_parsing": "Debe ser un número entero.",
    "int_type": "Debe ser un número entero.",
    "bool_parsing": "Debe ser verdadero o falso.",
    "datetime_parsing": "Debe ser una fecha y hora válida (ISO 8601).",
    "datetime_from_date_parsing": "Debe ser una fecha y hora válida (ISO 8601).",
    "greater_than": "Valor demasiado bajo.",
    "greater_than_equal": "Valor demasiado bajo.",
    "less_than_equal": "Valor demasiado alto.",
    "enum": "Valor no permitido.",
    "literal_error": "Valor no permitido.",
    "string_pattern_mismatch": "Formato inválido.",
    "json_invalid": "El cuerpo no es un JSON válido.",
}


def _traducir(err: dict) -> dict:
    loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path")]
    if err.get("type") == "value_error":
        # Mensajes de validadores propios (ValueError): ya vienen en español.
        mensaje = str(err.get("msg", "")).removeprefix("Value error, ")
    else:
        mensaje = _MENSAJES.get(err.get("type", ""), "Valor inválido.")
    return {"field": ".".join(loc), "message": mensaje}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=_body(exc.detail, exc.code, exc.fields))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [_traducir(e) for e in exc.errors()]
        return JSONResponse(status_code=422, content=_body("Datos inválidos.", "VALIDATION_ERROR", fields))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code in (404, 405):
            return JSONResponse(status_code=exc.status_code, content=_body("Recurso no encontrado.", "NOT_FOUND"))
        return JSONResponse(status_code=exc.status_code, content=_body("Solicitud no válida.", "HTTP_ERROR"))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Error no controlado", exc_info=exc)  # la traza queda solo en el servidor
        return JSONResponse(
            status_code=500, content=_body("Error interno del servidor.", "INTERNAL_ERROR")
        )
