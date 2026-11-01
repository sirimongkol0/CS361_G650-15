from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException

from config import settings
from database import engine, Base
from routers import health, partners, activities, documents
from routers import auth as auth_routes
from routers import audit_logs
from routers import exchange
from routers import feedback, users, imports, exports, outcomes, insights, renewals, improvements
import schemas

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Partner Activity API")

# CORS origins are environment-driven so local/demo frontends can use the
# same image without a code change.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
    # Paging total for /audit-logs/ and the filename of CSV downloads.
    expose_headers=["X-Total-Count", "Content-Disposition"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Keep application errors on the documented ``{"detail": ...}`` shape."""
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=schemas.ErrorResponse(detail=detail).model_dump(),
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Field-level errors (``[{"loc", "msg", "type"}]``) with Thai messages for the web form."""
    return JSONResponse(
        status_code=422,
        content={"detail": [
            {"loc": list(error["loc"]), "msg": _thai_message(error), "type": error["type"]}
            for error in exc.errors()
        ]},
    )


def _thai_message(error: dict) -> str:
    """Pydantic's English text -> Thai; a ``ValueError`` from schemas.py is already Thai."""
    kind, ctx = error["type"], error.get("ctx") or {}
    if kind == "value_error":
        return str(ctx.get("error", error["msg"]))
    messages = {
        "missing": "ต้องระบุข้อมูลนี้",
        "extra_forbidden": "ไม่รองรับฟิลด์นี้",
        "greater_than_equal": f"ต้องมีค่าอย่างน้อย {ctx.get('ge')}",
        "less_than_equal": f"ต้องมีค่าไม่เกิน {ctx.get('le')}",
        "greater_than": f"ต้องมีค่ามากกว่า {ctx.get('gt')}",
        "less_than": f"ต้องมีค่าน้อยกว่า {ctx.get('lt')}",
        "string_too_short": f"ต้องมีความยาวอย่างน้อย {ctx.get('min_length')} ตัวอักษร",
        "string_too_long": f"ต้องมีความยาวไม่เกิน {ctx.get('max_length')} ตัวอักษร",
        "string_pattern_mismatch": "รูปแบบข้อมูลไม่ถูกต้อง",
        "literal_error": f"ต้องเป็นค่าใดค่าหนึ่งต่อไปนี้: {ctx.get('expected')}",
        "int_parsing": "ต้องเป็นจำนวนเต็ม",
        "int_type": "ต้องเป็นจำนวนเต็ม",
        "date_from_datetime_parsing": "ต้องเป็นวันที่ในรูปแบบ YYYY-MM-DD",
        "date_parsing": "ต้องเป็นวันที่ในรูปแบบ YYYY-MM-DD",
        "date_type": "ต้องเป็นวันที่ในรูปแบบ YYYY-MM-DD",
        "bool_parsing": "ต้องเป็นค่าจริงหรือเท็จ",
        "json_invalid": "ข้อมูล JSON ไม่ถูกต้อง",
    }
    return messages.get(kind, "ข้อมูลไม่ถูกต้อง")


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=schemas.ErrorResponse(detail="Internal server error").model_dump(),
    )


# Include routers under /api/v1
app.include_router(health.router, prefix="/api/v1")
app.include_router(partners.router, prefix="/api/v1")
app.include_router(activities.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(auth_routes.router, prefix="/api/v1")
app.include_router(audit_logs.router, prefix="/api/v1")
app.include_router(exchange.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(imports.router, prefix="/api/v1")
app.include_router(exports.router,prefix="/api/v1",)
app.include_router(outcomes.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(renewals.router, prefix="/api/v1")
app.include_router(improvements.router, prefix="/api/v1")
# Internal routers are mounted only once their endpoints are protected with
# auth.require_role(...) (V3).
