"""One ``auth.optional_user`` for public reads: a supplied token is checked like
``get_current_user``, and staff/admin or the owner can open their drafts."""
from datetime import date

import pytest

import models
from tests.test_auth import assert_error, bearer, cognito, make_token, token_for  # noqa: F401

PARTNERS = "/api/v1/partners/"


def _draft_partner(db_session):
    partner = models.Partner(name="Draft partner", is_published=False)
    db_session.add(partner)
    db_session.commit()
    return partner


def test_partners_with_revoked_token_is_401(client, cognito):
    token = token_for(client, "staff")
    assert client.post("/api/v1/auth/logout", headers=bearer(token)).status_code == 204
    assert_error(client.get(PARTNERS, headers=bearer(token)), 401, "Invalid or expired token")


def test_partners_with_expired_token_is_401(client, cognito):
    token_for(client, "staff")
    expired = make_token(cognito.users["staff@example.test"]["sub"], ["staff"], lifetime=-60)
    assert_error(client.get(PARTNERS, headers=bearer(expired)), 401, "Invalid or expired token")


def test_partners_with_disabled_account_is_403(client, cognito, db_session):
    token = token_for(client, "staff")
    db_session.query(models.User).update({"is_active": False})
    db_session.commit()
    assert_error(client.get(PARTNERS, headers=bearer(token)), 403, "Account is disabled")


def test_partners_follow_the_tokens_current_role(client, cognito, db_session):
    _draft_partner(db_session)
    staff = token_for(client, "staff")
    assert [p["name"] for p in client.get(PARTNERS, headers=bearer(staff)).json()] == ["Draft partner"]

    demoted = make_token(cognito.users["staff@example.test"]["sub"], ["student"])
    assert client.get(PARTNERS, headers=bearer(demoted)).json() == []
    db_session.expire_all()
    assert db_session.query(models.User).filter_by(email="staff@example.test").one().role == "student"


def _drafts(db_session, owner_id):
    document = models.Document(name="Draft MoU", effective_date=date(2026, 1, 1),
                               is_published=False, owner_user_id=owner_id)
    activity = models.Activity(name="Draft activity", date=date(2026, 2, 1),
                               is_published=False, owner_user_id=owner_id)
    exchange = models.ExchangeStudent(name="Draft exchange", program="แลกเปลี่ยน",
                                      is_published=False, owner_user_id=owner_id)
    db_session.add_all([document, activity, exchange])
    db_session.commit()
    return [f"/api/v1/documents/{document.id}", f"/api/v1/activities/{activity.id}",
            f"/api/v1/exchange/{exchange.id}"]


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_managers_open_draft_details(client, cognito, db_session, role):
    headers = bearer(token_for(client, role))
    for path in _drafts(db_session, owner_id=None):
        assert client.get(path, headers=headers).status_code == 200, path


def test_owner_opens_own_draft_details_but_not_others(client, cognito, db_session):
    headers = bearer(token_for(client, "coordinator"))
    me = db_session.query(models.User).filter_by(email="coordinator@example.test").one()
    for path in _drafts(db_session, owner_id=me.id):
        assert client.get(path, headers=headers).status_code == 200, path
    for path in _drafts(db_session, owner_id=None):
        assert client.get(path, headers=headers).status_code == 404, path


def test_public_still_gets_404_for_draft_details(client, db_session):
    for path in _drafts(db_session, owner_id=None):
        assert client.get(path).status_code == 404, path
