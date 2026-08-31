from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from config import settings
from database import engine, Base
from routers import health, partners, activities, documents, feedback, exchange, users
import schemas

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Partner Activity API")

# CORS middleware for localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=schemas.ErrorResponse(status_code=422, detail=str(exc.errors())).dict()
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=schemas.ErrorResponse(status_code=500, detail="Internal server error").dict()
    )


# Include routers under /api/v1
app.include_router(health.router, prefix="/api/v1")
app.include_router(partners.router, prefix="/api/v1")
app.include_router(activities.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")
app.include_router(exchange.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
