"""Shared backend test isolation.

Tests default to an in-memory SQLite database, never the developer's app.db.
CI can exercise PostgreSQL by setting TEST_DATABASE_URL explicitly.
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url


# This must be set before importing database/main because settings and the
# SQLAlchemy engine are created at module import time.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite://")
os.environ["STORAGE_BACKEND"] = "local"
test_url = make_url(os.environ["DATABASE_URL"])
if test_url.get_backend_name() != "sqlite" and not (test_url.database or "").endswith("_test"):
    raise RuntimeError("Destructive tests require a dedicated database ending in _test")

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
