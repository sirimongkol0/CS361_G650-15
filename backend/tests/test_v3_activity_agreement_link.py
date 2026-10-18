"""V3-7: link an activity to its agreement (activities.mou_document_id) from the web.

Staff/admin may link any live agreement; coordinators only their own or a public one.
"""
from datetime import datetime, timezone

import pytest

import models
from tests.test_auth import bearer, cognito, token_for  # noqa: F401


def _user_id(db_session, role):
    return db_session.query(models.User).filter_by(email=f"{role}@example.test").one().id


def _other_user(db_session):
    other = models.User(cognito_sub="other-coordinator", email="other@example.test", role="coordinator",
                        created_at=datetime.now(timezone.utc))
    db_session.add(other)
    db_session.flush()
    return other


def _agreement(db_session, owner_id=None, public=False, deleted=False, name="MoU ทดสอบ"):
    doc = models.Document(name=name, document_kind="agreement", doc_type="mou", status="active" if public else "draft",
                          file_availability="metadata_only", owner_user_id=owner_id, is_deleted=deleted,
                          is_published=public, cstu_status="keep" if public else "review")
    if public:
        doc.sources = [models.Source(source_url=f"https://example.test/{name}", source_type="official_document",
                                     source_checked_at=datetime.now(timezone.utc), verification_status="verified")]
    db_session.add(doc)
    db_session.commit()
    return doc


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_staff_admin_link_any_live_agreement_and_it_is_audited(client, db_session, cognito, role):
    headers = bearer(token_for(client, role))
    doc = _agreement(db_session, owner_id=_other_user(db_session).id)  # someone else's draft
    response = client.post("/api/v1/activities/", json={"name": "สัมมนาร่วม", "mou_document_id": doc.id}, headers=headers)
    assert response.status_code == 201, response.text
    assert response.json()["mouDocId"] == doc.id
    listed = client.get("/api/v1/activities/manage", headers=headers).json()
    assert [a["mouDocId"] for a in listed] == [doc.id]
    log = db_session.query(models.AuditLog).filter_by(entity="activities", action="create").one()
    assert log.after["mou_document_id"] == doc.id


@pytest.mark.parametrize("make", ["missing", "deleted"])
def test_missing_or_deleted_agreement_is_422(client, db_session, cognito, make):
    headers = bearer(token_for(client, "staff"))
    doc_id = 999 if make == "missing" else _agreement(db_session, deleted=True).id
    response = client.post("/api/v1/activities/", json={"name": "x", "mou_document_id": doc_id}, headers=headers)
    assert response.status_code == 422
    assert db_session.query(models.Activity).count() == 0


@pytest.mark.parametrize(("owner", "public", "status"), [
    ("self", False, 201),   # own draft
    ("other", True, 201),   # someone else's public agreement
    ("other", False, 422),  # someone else's draft: the coordinator cannot see it
])
def test_coordinator_links_only_agreements_they_can_see(client, db_session, cognito, owner, public, status):
    headers = bearer(token_for(client, "coordinator"))
    owner_id = _user_id(db_session, "coordinator") if owner == "self" else _other_user(db_session).id
    doc = _agreement(db_session, owner_id=owner_id, public=public)
    response = client.post("/api/v1/activities/", json={"name": "กิจกรรม", "mou_document_id": doc.id}, headers=headers)
    assert response.status_code == status, response.text


def test_coordinator_cannot_relink_to_a_hidden_agreement_but_can_unlink(client, db_session, cognito):
    headers = bearer(token_for(client, "coordinator"))
    own = _agreement(db_session, owner_id=_user_id(db_session, "coordinator"), name="ของตัวเอง")
    hidden = _agreement(db_session, owner_id=_other_user(db_session).id, name="ของคนอื่น")
    created = client.post("/api/v1/activities/", json={"name": "กิจกรรม", "mou_document_id": own.id}, headers=headers).json()
    url = f"/api/v1/activities/{created['id']}"
    assert client.patch(url, json={"mou_document_id": hidden.id}, headers=headers).status_code == 422
    assert db_session.get(models.Activity, created["id"]).mou_document_id == own.id
    # Other edits keep the existing link without re-checking it.
    assert client.patch(url, json={"name": "ชื่อใหม่", "mou_document_id": own.id}, headers=headers).status_code == 200
    unlinked = client.patch(url, json={"mou_document_id": None}, headers=headers)
    assert unlinked.status_code == 200 and unlinked.json()["mouDocId"] is None
