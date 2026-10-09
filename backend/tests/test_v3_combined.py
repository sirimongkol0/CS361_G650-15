"""Combined V3 checks that cover every endpoint, including ones added later by V3-2 to V3-4.

They inspect the app's routes, so a new write endpoint that forgets ``require_role``
fails here without anyone having to add a test for it.
"""

import re

import pytest
from fastapi.routing import APIRoute

import auth
from main import app

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
# The only write endpoint that must work without a token.
PUBLIC_WRITES = {("POST", "/api/v1/auth/login")}


def _depends_on_login(dependant) -> bool:
    for dep in dependant.dependencies:
        if dep.call in (auth.get_current_user, auth.get_token_claims) or _depends_on_login(dep):
            return True
    return False


def _routes():
    for route in app.routes:
        if isinstance(route, APIRoute):
            for method in sorted(route.methods):
                yield method, route


WRITE_ROUTES = [(m, r) for m, r in _routes() if m in WRITE_METHODS and (m, r.path) not in PUBLIC_WRITES]
PROTECTED_ROUTES = [(m, r) for m, r in _routes() if (m, r.path) not in PUBLIC_WRITES and _depends_on_login(r.dependant)]


def _url(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "1", path)


def test_there_are_routes_to_check():
    assert WRITE_ROUTES and PROTECTED_ROUTES


@pytest.mark.parametrize("method,route", WRITE_ROUTES, ids=lambda v: v if isinstance(v, str) else v.path)
def test_every_write_endpoint_requires_login(method, route):
    """Every POST/PUT/PATCH/DELETE (except login) must depend on require_role / get_current_user."""
    assert _depends_on_login(route.dependant), f"{method} {route.path} has no require_role(...)"


@pytest.mark.parametrize("method,route", PROTECTED_ROUTES, ids=lambda v: v if isinstance(v, str) else v.path)
def test_every_protected_endpoint_answers_401_without_a_token(client, cognito, method, route):
    response = client.request(method, _url(route.path), json={})
    assert response.status_code == 401, f"{method} {route.path} -> {response.status_code}"
    assert response.headers.get("WWW-Authenticate") == "Bearer"
    assert set(response.json()) == {"detail"}


@pytest.mark.parametrize("method,route", PROTECTED_ROUTES, ids=lambda v: v if isinstance(v, str) else v.path)
def test_every_protected_endpoint_rejects_a_forged_token(client, cognito, method, route):
    response = client.request(method, _url(route.path), json={}, headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401, f"{method} {route.path} -> {response.status_code}"


def test_public_reads_still_need_no_login(client):
    public_gets = [r for m, r in _routes() if m == "GET" and not _depends_on_login(r.dependant)
                   and r.path.startswith("/api/v1/") and "{" not in r.path]
    assert public_gets
    for route in public_gets:
        assert client.get(route.path).status_code == 200, route.path


# Import the fake-Cognito fixture so the protected checks run with login configured.
from tests.test_auth import cognito  # noqa: E402,F401
