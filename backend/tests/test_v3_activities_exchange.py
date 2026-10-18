"""V3-4 activity and exchange CRUD, ownership, and audit regression tests."""
from datetime import datetime, timezone

import models
from tests.test_auth import bearer, cognito, token_for  # noqa: F401


def test_activity_create_is_owned_and_audited(client, db_session, cognito):
    headers = bearer(token_for(client, "coordinator"))
    response = client.post("/api/v1/activities/", json={"name": "Owned activity", "is_published": True}, headers=headers)
    assert response.status_code == 201, response.text
    row = db_session.query(models.Activity).filter_by(name="Owned activity").one()
    user = db_session.query(models.User).filter_by(email="coordinator@example.test").one()
    assert row.owner_user_id == user.id
    assert row.is_published is False  # coordinator cannot publish on create
    log = db_session.query(models.AuditLog).filter_by(entity="activities", entity_id=row.id).one()
    assert log.action == "create"


def test_coordinator_cannot_edit_another_owners_activity(client, db_session, cognito):
    other = models.User(cognito_sub="other-sub", email="other@example.test", role="coordinator",
                        created_at=datetime.now(timezone.utc))
    db_session.add(other)
    db_session.flush()
    row = models.Activity(name="Someone else's activity", owner_user_id=other.id)
    db_session.add(row)
    db_session.commit()
    response = client.patch(f"/api/v1/activities/{row.id}", json={"name": "Hijacked"},
                            headers=bearer(token_for(client, "coordinator")))
    assert response.status_code == 403
    db_session.refresh(row)
    assert row.name == "Someone else's activity"


def test_activity_delete_is_soft_and_staff_admin_only(client, db_session, cognito):
    row = models.Activity(name="Delete me", is_published=True)
    db_session.add(row)
    db_session.commit()
    response = client.delete(f"/api/v1/activities/{row.id}", headers=bearer(token_for(client, "staff")))
    assert response.status_code == 204
    db_session.refresh(row)
    assert row.is_deleted is True and row.is_published is False
    assert client.get("/api/v1/activities/").json() == []
    assert db_session.query(models.AuditLog).filter_by(entity="activities", entity_id=row.id, action="delete").count() == 1


def test_exchange_student_sees_only_owned_records(client, db_session, cognito):
    headers = bearer(token_for(client, "student"))
    user = db_session.query(models.User).filter_by(email="student@example.test").one()
    other = models.User(cognito_sub="other-student-sub", email="other-student@example.test", role="student",
                        created_at=datetime.now(timezone.utc))
    db_session.add(other)
    db_session.flush()
    mine = models.ExchangeStudent(name="Mine", user_id=user.id, owner_user_id=other.id, is_published=False)
    theirs = models.ExchangeStudent(name="Theirs", user_id=other.id, owner_user_id=other.id, is_published=False)
    db_session.add_all([mine, theirs])
    db_session.commit()
    response = client.get("/api/v1/exchange/mine", headers=headers)
    assert response.status_code == 200
    assert [row["name"] for row in response.json()] == ["Mine"]
    assert client.get(f"/api/v1/exchange/mine/{theirs.id}", headers=headers).status_code == 404
    assert client.get("/api/v1/exchange/").json() == []


def test_exchange_create_and_patch_support_audit(client, db_session, cognito):
    headers = bearer(token_for(client, "staff"))
    student_user = models.User(cognito_sub="target-student", email="target-student@example.test", role="student",
                                created_at=datetime.now(timezone.utc))
    db_session.add(student_user)
    db_session.commit()
    response = client.post("/api/v1/exchange/", json={"name": "Outbound student", "user_id": student_user.id}, headers=headers)
    assert response.status_code == 201, response.text
    record_id = response.json()["id"]
    updated = client.patch(f"/api/v1/exchange/{record_id}", json={"status": "เสร็จสิ้น"}, headers=headers)
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "เสร็จสิ้น"
    assert db_session.query(models.AuditLog).filter_by(entity="exchange_students", entity_id=record_id).count() == 2

def test_coordinator_cannot_publish_activity_on_update(
    client, db_session, cognito
):
    headers = bearer(token_for(client, "coordinator"))
    response = client.post(
        "/api/v1/activities/",
        json={"name": "Draft activity"},
        headers=headers,
    )
    assert response.status_code == 201, response.text

    activity_id = response.json()["id"]
    response = client.patch(
        f"/api/v1/activities/{activity_id}",
        json={"is_published": True},
        headers=headers,
    )
    assert response.status_code == 403


def test_coordinator_cannot_publish_exchange_on_update(
    client, db_session, cognito
):
    headers = bearer(token_for(client, "coordinator"))
    response = client.post(
        "/api/v1/exchange/",
        json={"name": "Draft exchange"},
        headers=headers,
    )
    assert response.status_code == 201, response.text

    exchange_id = response.json()["id"]
    response = client.patch(
        f"/api/v1/exchange/{exchange_id}",
        json={"is_published": True},
        headers=headers,
    )
    assert response.status_code == 403


def test_coordinator_cannot_edit_another_owners_exchange(
    client, db_session, cognito
):
    other = models.User(
        cognito_sub="other-exchange-owner",
        email="other-exchange-owner@example.test",
        role="coordinator",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(other)
    db_session.flush()

    row = models.ExchangeStudent(
        name="Another coordinator's record",
        owner_user_id=other.id,
        is_published=False,
    )
    db_session.add(row)
    db_session.commit()

    response = client.patch(
        f"/api/v1/exchange/{row.id}",
        json={"name": "Hijacked"},
        headers=bearer(token_for(client, "coordinator")),
    )
    assert response.status_code == 403

    db_session.refresh(row)
    assert row.name == "Another coordinator's record"


# --- V3-7: internal lists for the web forms ---------------------------------------

import pytest  # noqa: E402


def _user(db_session, email):
    return db_session.query(models.User).filter_by(email=email).one()


@pytest.mark.parametrize("role,status", [("public", 403), ("student", 403), ("coordinator", 200),
                                         ("staff", 200), ("admin", 200)])
def test_activity_manage_list_by_role(client, db_session, cognito, role, status):
    headers = bearer(token_for(client, role))
    response = client.get("/api/v1/activities/manage", headers=headers)
    assert response.status_code == status


def test_activity_manage_list_scopes_coordinators_and_shows_unpublished(client, db_session, cognito):
    coordinator = bearer(token_for(client, "coordinator"))
    staff = bearer(token_for(client, "staff"))
    owner = _user(db_session, "coordinator@example.test")
    db_session.add_all([
        models.Activity(name="Mine draft", owner_user_id=owner.id, is_published=False),
        models.Activity(name="Someone else's", owner_user_id=None, is_published=True),
        models.Activity(name="Deleted", owner_user_id=owner.id, is_deleted=True),
    ])
    db_session.commit()
    mine = client.get("/api/v1/activities/manage", headers=coordinator).json()
    assert [(a["name"], a["isPublished"], a["ownerUserId"]) for a in mine] == [("Mine draft", False, owner.id)]
    assert {a["name"] for a in client.get("/api/v1/activities/manage", headers=staff).json()} == {"Mine draft", "Someone else's"}
    assert client.get("/api/v1/activities/manage").status_code == 401


def test_activity_writes_return_owner_and_publication(client, db_session, cognito):
    headers = bearer(token_for(client, "staff"))
    created = client.post("/api/v1/activities/", json={"name": "Visible fields"}, headers=headers).json()
    assert created["ownerUserId"] == _user(db_session, "staff@example.test").id
    assert created["isPublished"] is False
    # The public list still has no owner fields.
    db_session.query(models.Activity).filter_by(id=created["id"]).update({"is_published": True})
    db_session.commit()
    public = client.get("/api/v1/activities/").json()
    assert public and "ownerUserId" not in public[0] and "isPublished" not in public[0]


def test_exchange_mine_exposes_owner_fields_but_public_list_does_not(client, db_session, cognito):
    headers = bearer(token_for(client, "staff"))
    staff = _user(db_session, "staff@example.test")
    db_session.add(models.ExchangeStudent(name="Published record", is_published=True, owner_user_id=staff.id))
    db_session.commit()
    mine = client.get("/api/v1/exchange/mine", headers=headers).json()
    assert (mine[0]["isPublished"], mine[0]["ownerUserId"]) == (True, staff.id)
    assert "userId" in mine[0]
    public = client.get("/api/v1/exchange/").json()
    assert "ownerUserId" not in public[0] and "userId" not in public[0]
