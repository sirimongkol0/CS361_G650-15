from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException

from config import settings
from database import engine, Base
from routers import health, partners, activities, documents, feedback, exchange, users
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
    allow_methods=["*"],
    allow_headers=["*"],
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
    return JSONResponse(
        status_code=422,
        content=schemas.ErrorResponse(detail="Request validation failed").model_dump(),
    )


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
app.include_router(feedback.router, prefix="/api/v1")
app.include_router(exchange.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
