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
os.environ["CORS_ORIGINS"] = "http://localhost:3000,http://localhost:3001"
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


# --- V3 login: fake Cognito + per-role auth headers --------------------------

import auth  # noqa: E402
import models  # noqa: E402
from config import settings  # noqa: E402
from tests.auth_helpers import CLIENT_ID, POOL_ID, SIGNING_KEY, FakeCognito, make_token  # noqa: E402


@pytest.fixture()
def cognito(monkeypatch):
    """Point the backend at a fake Cognito with one account per role (``<role>@example.test``)."""
    fake = FakeCognito()
    monkeypatch.setattr(settings, "COGNITO_REGION", "ap-southeast-1")
    monkeypatch.setattr(settings, "COGNITO_USER_POOL_ID", POOL_ID)
    monkeypatch.setattr(settings, "COGNITO_APP_CLIENT_ID", CLIENT_ID)
    monkeypatch.setattr(auth, "get_signing_key", lambda token: SIGNING_KEY.public_key())
    monkeypatch.setattr(auth, "cognito_client", lambda: fake)
    for role in models.ROLES:
        fake.add(f"{role}@example.test", [role])
    return fake


class AuthHeaders(dict):
    """``Authorization`` header for a signed-in test user; ``.user_id`` is its ``users.id``."""

    user_id: int


@pytest.fixture()
def auth_headers(cognito):
    """Headers for a signed-in user of ``role``, e.g. ``client.post(url, headers=auth_headers("staff"))``.

    Pass ``name`` for a second user of the same role (``auth_headers("coordinator", name="other")``),
    e.g. to test that a coordinator cannot edit records owned by someone else.
    """
    def make(role: str, name: str | None = None) -> AuthHeaders:
        assert role in models.ROLES, f"unknown role {role!r}"
        name = name or role
        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.cognito_sub == f"test-{name}").first()
            if user is None:
                user = models.User(cognito_sub=f"test-{name}", email=f"{name}@example.test",
                                   role=role, created_at=auth.utcnow())
                db.add(user)
                db.commit()
            user_id = user.id
        headers = AuthHeaders(Authorization=f"Bearer {make_token(f'test-{name}', [role])}")
        headers.user_id = user_id
        return headers

    return make
