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
