"""Shared backend test isolation.

Tests default to an in-memory SQLite database, never the developer's app.db.
CI can exercise PostgreSQL by setting TEST_DATABASE_URL explicitly.
"""

import os

import pytest
from fastapi.testclient import TestClient


# This must be set before importing database/main because settings and the
# SQLAlchemy engine are created at module import time.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite://")

from database import Base, SessionLocal, engine  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(scope="function", autouse=True)
def setup_database(tmp_path, monkeypatch):
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr("config.settings.LOCAL_STORAGE_DIR", str(tmp_path))
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    return TestClient(app)
