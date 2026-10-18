"""V3-7 feedback replies and the admin user list: roles, privacy and audit rows."""
from datetime import date

import pytest
from sqlalchemy import create_engine, inspect, text

import models
from migrate_v3 import migrate
from tests.test_auth import bearer, cognito, token_for  # noqa: F401


def _feedback(db_session, **fields):
    row = models.Feedback(title=fields.pop("title", "Seminar feedback"), rating=4, date=date(2026, 5, 1),
                          status="รอตรวจสอบ", comment="Useful session.", **fields)
    db_session.add(row)
    db_session.commit()
    return row


# --- feedback ----------------------------------------------------------------

def test_public_feedback_hides_unpublished_rows_and_replies(client, db_session):
    _feedback(db_session, title="Published", is_published=True, reply="Thanks")
    _feedback(db_session, title="Hidden", is_published=False)
    rows = client.get("/api/v1/feedback/").json()
    assert [row["title"] for row in rows] == ["Published"]
    assert "reply" not in rows[0] and "isPublished" not in rows[0]


@pytest.mark.parametrize(("role", "status"), [
    ("public", 403), ("student", 403), ("coordinator", 200), ("staff", 200), ("admin", 200),
])
def test_feedback_manage_list_by_role(client, db_session, cognito, role, status):
    _feedback(db_session, title="Hidden", is_published=False)
    response = client.get("/api/v1/feedback/manage", headers=bearer(token_for(client, role)))
    assert response.status_code == status
    if status == 200:
        assert [row["title"] for row in response.json()] == ["Hidden"]
        assert response.json()[0]["isPublished"] is False


def test_feedback_manage_list_needs_login(client):
    assert client.get("/api/v1/feedback/manage").status_code == 401


@pytest.mark.parametrize(("role", "status"), [
    ("public", 403), ("student", 403), ("coordinator", 200), ("staff", 200), ("admin", 200),
])
def test_feedback_reply_by_role(client, db_session, cognito, role, status):
    row = _feedback(db_session)
    response = client.patch(f"/api/v1/feedback/{row.id}", json={"reply": "  Noted, thank you.  ", "status": "ตรวจสอบแล้ว"},
                            headers=bearer(token_for(client, role)))
    assert response.status_code == status, response.text
    db_session.refresh(row)
    if status == 200:
        user = db_session.query(models.User).filter_by(email=f"{role}@example.test").one()
        body = response.json()
        assert body["reply"] == "Noted, thank you." and body["status"] == "ตรวจสอบแล้ว"
        assert body["repliedByUserId"] == user.id and body["repliedAt"]
        log = db_session.query(models.AuditLog).filter_by(entity="feedbacks", entity_id=row.id).one()
        assert log.action == "update" and log.user_id == user.id
        assert log.before["reply"] is None and log.after["reply"] == "Noted, thank you."
    else:
        assert row.reply is None and row.status == "รอตรวจสอบ"
        assert db_session.query(models.AuditLog).filter_by(entity="feedbacks").count() == 0


def test_coordinator_cannot_publish_feedback(client, db_session, cognito):
    row = _feedback(db_session)
    response = client.patch(f"/api/v1/feedback/{row.id}", json={"is_published": True},
                            headers=bearer(token_for(client, "coordinator")))
    assert response.status_code == 403
    db_session.refresh(row)
    assert row.is_published is False


def test_staff_publishes_and_clears_reply(client, db_session, cognito):
    row = _feedback(db_session, reply="Old reply")
    headers = bearer(token_for(client, "staff"))
    response = client.patch(f"/api/v1/feedback/{row.id}", json={"is_published": True, "reply": ""}, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["isPublished"] is True
    assert response.json()["reply"] is None and response.json()["repliedAt"] is None
    assert [f["id"] for f in client.get("/api/v1/feedback/").json()] == [row.id]


@pytest.mark.parametrize("body", [{"status": "unknown"}, {"reply": "x" * 2001}, {"title": "Renamed"}])
def test_feedback_update_rejects_invalid_body(client, db_session, cognito, body):
    row = _feedback(db_session)
    response = client.patch(f"/api/v1/feedback/{row.id}", json=body, headers=bearer(token_for(client, "staff")))
    assert response.status_code == 422


def test_feedback_update_missing_row_is_404(client, cognito):
    response = client.patch("/api/v1/feedback/999", json={"reply": "x"}, headers=bearer(token_for(client, "staff")))
    assert response.status_code == 404


# --- users -------------------------------------------------------------------

@pytest.mark.parametrize(("role", "status"), [
    ("public", 403), ("student", 403), ("coordinator", 403), ("staff", 403), ("admin", 200),
])
def test_user_list_is_admin_only(client, cognito, role, status):
    token = token_for(client, role)
    response = client.get("/api/v1/users/", headers=bearer(token))
    assert response.status_code == status
    if status == 200:
        (row,) = response.json()
        assert row["email"] == "admin@example.test" and row["role"] == "admin"
        assert row["isActive"] is True and row["lastLoginAt"] and row["createdAt"]


def test_user_list_needs_login(client):
    assert client.get("/api/v1/users/").status_code == 401


def test_user_detail_is_admin_only(client, db_session, cognito):
    student_token = token_for(client, "student")
    admin_headers = bearer(token_for(client, "admin"))
    student = db_session.query(models.User).filter_by(email="student@example.test").one()
    assert client.get(f"/api/v1/users/{student.id}", headers=bearer(student_token)).status_code == 403
    response = client.get(f"/api/v1/users/{student.id}", headers=admin_headers)
    assert response.status_code == 200 and response.json()["role"] == "student"
    assert client.get("/api/v1/users/999", headers=admin_headers).status_code == 404


# --- migration ---------------------------------------------------------------

def test_v3_7_migration_adds_reply_columns_and_keeps_feedback(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v37.db'}")
    try:
        with engine.begin() as c:
            c.exec_driver_sql("CREATE TABLE feedbacks (id INTEGER PRIMARY KEY, title VARCHAR NOT NULL, "
                              "is_published BOOLEAN NOT NULL DEFAULT false)")
            c.exec_driver_sql("INSERT INTO feedbacks (id, title) VALUES (5, 'Existing feedback')")
        migrate(engine)
        migrate(engine)
        columns = {column["name"] for column in inspect(engine).get_columns("feedbacks")}
        assert {"reply", "replied_at", "replied_by_user_id"} <= columns
        with engine.connect() as c:
            assert c.execute(text("SELECT title, reply FROM feedbacks WHERE id = 5")).one() == ("Existing feedback", None)
    finally:
        engine.dispose()
