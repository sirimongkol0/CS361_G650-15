"""POST /auth/change-password: the signed-in user changes their own Cognito password."""
import pytest
from botocore.exceptions import ClientError

import models
from tests.test_auth import PASSWORD, bearer, cognito, login, token_for  # noqa: F401

NEW_PASSWORD = "Another-Passw0rd"
URL = "/api/v1/auth/change-password"


@pytest.mark.parametrize("role", models.ROLES)
def test_every_role_changes_own_password_and_logs_in_with_it(client, db_session, cognito, role):
    headers = bearer(token_for(client, role))
    response = client.post(URL, json={"current_password": PASSWORD, "new_password": NEW_PASSWORD}, headers=headers)
    assert response.status_code == 204, response.text
    email = f"{role}@example.test"
    assert login(client, email).status_code == 401
    assert login(client, email, NEW_PASSWORD).status_code == 200
    user = db_session.query(models.User).filter_by(email=email).one()
    log = db_session.query(models.AuditLog).filter_by(action="change_password").one()
    assert (log.user_id, log.entity, log.entity_id) == (user.id, "users", user.id)
    assert log.before is None and log.after is None  # no password ever reaches the log


def test_needs_login(client, cognito):
    assert client.post(URL, json={"current_password": PASSWORD, "new_password": NEW_PASSWORD}).status_code == 401


def test_wrong_current_password_is_400_not_401(client, db_session, cognito):
    # 401 would make the web sign the user out.
    response = client.post(URL, json={"current_password": "Wrong-Passw0rd", "new_password": NEW_PASSWORD},
                           headers=bearer(token_for(client, "staff")))
    assert response.status_code == 400
    assert response.json() == {"detail": "Current password is incorrect"}
    assert db_session.query(models.AuditLog).filter_by(action="change_password").count() == 0


@pytest.mark.parametrize("new_password", ["alllowercase1", "NoNumbersHere"])
def test_policy_failure_is_422(client, cognito, new_password):
    response = client.post(URL, json={"current_password": PASSWORD, "new_password": new_password},
                           headers=bearer(token_for(client, "staff")))
    assert response.status_code == 422
    assert login(client, "staff@example.test").status_code == 200  # unchanged


@pytest.mark.parametrize("new_password", ["Sh0rt", PASSWORD])
def test_short_or_unchanged_password_is_rejected_before_cognito(client, cognito, new_password):
    response = client.post(URL, json={"current_password": PASSWORD, "new_password": new_password},
                           headers=bearer(token_for(client, "staff")))
    assert response.status_code == 422


def test_cognito_rate_limit_is_429(client, cognito, monkeypatch):
    headers = bearer(token_for(client, "staff"))

    def limited(**_):
        raise ClientError({"Error": {"Code": "LimitExceededException", "Message": "Attempt limit exceeded"}},
                          "ChangePassword")

    monkeypatch.setattr(cognito, "change_password", limited)
    response = client.post(URL, json={"current_password": PASSWORD, "new_password": NEW_PASSWORD}, headers=headers)
    assert response.status_code == 429
