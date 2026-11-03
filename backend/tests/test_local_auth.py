"""Local auth backend: login, role checks, password change and logout."""

from datetime import datetime, timezone

import jwt
import pytest

import models
from config import settings
from local_auth import hash_password

PASSWORD = "DemoPass123"


@pytest.fixture(autouse=True)
def local_mode(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_BACKEND", "local")
    monkeypatch.setattr(settings, "LOCAL_AUTH_SECRET", "test-local-secret")
    monkeypatch.setattr(settings, "LOCAL_AUTH_TOKEN_MINUTES", 60)


def add_user(db, role, password=PASSWORD, active=True):
    now = datetime.now(timezone.utc)
    user = models.User(
        cognito_sub=f"local:{role}@example.test",
        email=f"{role}@example.test",
        role=role,
        is_active=active,
        created_at=now,
    )
    db.add(user)
    db.flush()
    db.add(models.LocalCredential(
        user_id=user.id,
        password_hash=hash_password(password),
        updated_at=now,
    ))
    db.commit()
    return user


def login(client, role, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={
        "email": f"{role}@example.test", "password": password,
    })


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def token_for(client, role):
    response = login(client, role)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_local_login_returns_token_and_me(client, db_session):
    add_user(db_session, "student")
    response = login(client, "student")
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "student"
    assert body["token_type"] == "bearer"
    assert body["access_token"].count(".") == 2

    me = client.get("/api/v1/auth/me", headers=bearer(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "student@example.test"
    assert me.json()["role"] == "student"


def test_local_login_rejects_wrong_password(client, db_session):
    add_user(db_session, "student")
    response = login(client, "student", "WrongPass123")
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}


def test_local_login_rejects_disabled_account(client, db_session):
    add_user(db_session, "student", active=False)
    response = login(client, "student")
    assert response.status_code == 403


def test_local_role_is_enforced_by_the_api(client, db_session):
    add_user(db_session, "student")
    add_user(db_session, "admin")

    student = client.get("/api/v1/users/", headers=bearer(token_for(client, "student")))
    admin = client.get("/api/v1/users/", headers=bearer(token_for(client, "admin")))
    assert student.status_code == 403
    assert admin.status_code == 200


def test_local_change_password(client, db_session):
    add_user(db_session, "student")
    token = token_for(client, "student")

    changed = client.post(
        "/api/v1/auth/change-password",
        headers=bearer(token),
        json={"current_password": PASSWORD, "new_password": "NewPass456"},
    )
    assert changed.status_code == 204

    assert login(client, "student", PASSWORD).status_code == 401
    assert login(client, "student", "NewPass456").status_code == 200


def test_local_logout_revokes_token(client, db_session):
    add_user(db_session, "student")
    token = token_for(client, "student")

    assert client.get("/api/v1/auth/me", headers=bearer(token)).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=bearer(token)).status_code == 204
    assert client.get("/api/v1/auth/me", headers=bearer(token)).status_code == 401


def test_local_token_with_wrong_signature_is_rejected(client, db_session):
    add_user(db_session, "student")
    claims = {
        "sub": "local:student@example.test",
        "cognito:groups": ["student"],
        "token_use": "access",
        "iss": "pcsms-local",
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 60,
        "jti": "forged",
    }
    forged = jwt.encode(claims, "wrong-secret", algorithm="HS256")
    assert client.get("/api/v1/auth/me", headers=bearer(forged)).status_code == 401
