"""V3 login and server-side role checks, against a local fake of Cognito.

Tokens are signed with a throwaway RSA key, so CI needs no AWS access.
The fake Cognito lives in tests/auth_helpers.py; fixtures in conftest.py.
"""

import uuid

import pytest
from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from starlette.exceptions import HTTPException

import auth
import main
import models
from config import settings
from tests.auth_helpers import OTHER_KEY, PASSWORD, make_token


def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def token_for(client, role):
    response = login(client, f"{role}@example.test")
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def assert_error(response, status, detail):
    assert response.status_code == status
    assert response.json() == {"detail": detail}


# --- login -------------------------------------------------------------------

def test_login_returns_bearer_token_and_creates_user(client, cognito, db_session):
    response = login(client, "Student@Example.TEST")
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 3600
    assert body["role"] == "student"
    user = db_session.query(models.User).one()
    assert (user.email, user.role, user.is_active) == ("student@example.test", "student", True)
    assert user.cognito_sub == cognito.users["student@example.test"]["sub"]
    assert user.last_login_at is not None


def test_passwords_are_never_stored(client, cognito, db_session):
    token_for(client, "admin")
    columns = {c["name"] for c in inspect(db_session.bind).get_columns("users")}
    assert not any("password" in name for name in columns)
    row = db_session.query(models.User).one()
    assert PASSWORD not in repr([getattr(row, name) for name in columns])


@pytest.mark.parametrize("email,password", [
    ("student@example.test", "wrong-password"),
    ("nobody@example.test", PASSWORD),
])
def test_login_with_wrong_credentials_is_401(client, cognito, email, password):
    response = login(client, email, password)
    assert_error(response, 401, "Invalid email or password")
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("payload", [
    {}, {"email": "student@example.test"}, {"email": "not-an-email", "password": "x"},
    {"email": "student@example.test", "password": ""},
])
def test_login_validation_uses_error_format(client, cognito, payload):
    assert_error(client.post("/api/v1/auth/login", json=payload), 422, "Request validation failed")


def test_login_requiring_new_password_is_401(client, cognito):
    cognito.challenge = True
    assert_error(login(client, "student@example.test"), 401, "Password change required")


def test_login_without_cognito_configuration_is_503(client, cognito, monkeypatch):
    monkeypatch.setattr(settings, "COGNITO_USER_POOL_ID", "")
    assert_error(login(client, "student@example.test"), 503, "Authentication is not configured")


def test_disabled_account_cannot_log_in_or_use_token(client, cognito, db_session):
    token = token_for(client, "staff")
    db_session.query(models.User).update({"is_active": False})
    db_session.commit()
    assert_error(client.get("/api/v1/auth/me", headers=bearer(token)), 403, "Account is disabled")
    assert_error(login(client, "staff@example.test"), 403, "Account is disabled")


# --- /auth/me and token verification ------------------------------------------

def test_me_returns_current_user(client, cognito):
    response = client.get("/api/v1/auth/me", headers=bearer(token_for(client, "coordinator")))
    assert response.status_code == 200
    assert response.json() == {"id": 1, "email": "coordinator@example.test", "role": "coordinator"}


def test_me_without_token_is_401(client, cognito):
    response = client.get("/api/v1/auth/me")
    assert_error(response, 401, "Not authenticated")
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("bad", [
    {"key": OTHER_KEY},                 # forged signature
    {"lifetime": -60},                  # expired
    {"token_use": "id"},                # ID token is not an access token
    {"client_id": "another-client"},    # issued for another app
    {"issuer": "https://cognito-idp.ap-southeast-1.amazonaws.com/other-pool"},
])
def test_invalid_tokens_are_401(client, cognito, bad):
    token_for(client, "student")
    sub = cognito.users["student@example.test"]["sub"]
    token = make_token(sub, ["student"], **bad)
    assert_error(client.get("/api/v1/auth/me", headers=bearer(token)), 401, "Invalid or expired token")


def test_garbage_and_unknown_user_tokens_are_401(client, cognito):
    for token in ("not-a-jwt", make_token(str(uuid.uuid4()), ["admin"])):
        assert_error(client.get("/api/v1/auth/me", headers=bearer(token)),
                     401, "Invalid or expired token")


def test_role_follows_cognito_group_changes(client, cognito, db_session):
    token_for(client, "student")
    sub = cognito.users["student@example.test"]["sub"]
    response = client.get("/api/v1/auth/me", headers=bearer(make_token(sub, ["student", "staff"])))
    assert response.json()["role"] == "staff"
    assert db_session.query(models.User).one().role == "staff"


@pytest.mark.parametrize("groups,role", [
    ([], "public"), (["student"], "student"), (["coordinator", "student"], "coordinator"),
    (["admin", "public"], "admin"), (["unrelated-group"], "public"), (None, "public"),
])
def test_role_from_groups_picks_highest_known_role(groups, role):
    assert auth.role_from_groups(groups) == role


# --- logout -------------------------------------------------------------------

def test_logout_revokes_only_that_token(client, cognito, db_session):
    first = token_for(client, "student")
    second = token_for(client, "student")
    assert client.post("/api/v1/auth/logout", headers=bearer(first)).status_code == 204
    assert_error(client.get("/api/v1/auth/me", headers=bearer(first)), 401, "Invalid or expired token")
    assert_error(client.post("/api/v1/auth/logout", headers=bearer(first)), 401, "Invalid or expired token")
    assert client.get("/api/v1/auth/me", headers=bearer(second)).status_code == 200
    assert db_session.query(models.RevokedToken).count() == 1


def test_logout_without_token_is_401(client, cognito):
    assert_error(client.post("/api/v1/auth/logout"), 401, "Not authenticated")


# --- require_role -------------------------------------------------------------

@pytest.fixture()
def guarded_client():
    """A minimal app using the real exception handlers and require_role."""
    app = FastAPI()
    app.add_exception_handler(HTTPException, main.http_exception_handler)
    app.add_exception_handler(RequestValidationError, main.validation_exception_handler)

    @app.get("/staff-only")
    def staff_only(user: models.User = Depends(auth.require_role("staff", "admin"))):
        return {"role": user.role}

    return TestClient(app)


@pytest.mark.parametrize("role,status", [
    ("public", 403), ("student", 403), ("coordinator", 403), ("staff", 200), ("admin", 200),
])
def test_require_role_enforces_allowed_roles(client, guarded_client, cognito, role, status):
    response = guarded_client.get("/staff-only", headers=bearer(token_for(client, role)))
    assert response.status_code == status
    if status == 403:
        assert response.json() == {"detail": "Insufficient permissions"}
    else:
        assert response.json() == {"role": role}


@pytest.mark.parametrize("role,status", [("student", 403), ("coordinator", 403), ("staff", 200), ("admin", 200)])
def test_auth_headers_fixture_signs_in_each_role(guarded_client, auth_headers, role, status):
    assert guarded_client.get("/staff-only", headers=auth_headers(role)).status_code == status


def test_auth_headers_fixture_separates_users_of_one_role(auth_headers, db_session):
    mine, other = auth_headers("coordinator"), auth_headers("coordinator", name="other")
    assert mine.user_id != other.user_id
    assert db_session.get(models.User, other.user_id).email == "other@example.test"


def test_require_role_without_token_is_401(guarded_client, cognito):
    assert_error(guarded_client.get("/staff-only"), 401, "Not authenticated")


@pytest.mark.parametrize("roles", [(), ("superuser",), ("staff", "Staff")])
def test_require_role_rejects_unknown_roles_at_declaration(roles):
    with pytest.raises(ValueError):
        auth.require_role(*roles)


# --- public API unchanged -------------------------------------------------------

@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer not-a-jwt"}])
def test_public_get_endpoints_need_no_token(client, cognito, headers):
    for path in ("/api/v1/health", "/api/v1/partners", "/api/v1/activities", "/api/v1/documents"):
        assert client.get(path, headers=headers).status_code == 200, path
