"""V3-5 audit log: the shared helper, the staff/admin-only history API and its migration."""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, inspect, text

import audit
import models
from migrate_v3 import migrate
from tests.test_auth import bearer, cognito, token_for  # noqa: F401  (cognito is a fixture)

URL = "/api/v1/audit-logs/"


def make_user(db, name="staff", role="staff"):
    user = models.User(cognito_sub=f"sub-{name}", email=f"{name}@example.test", role=role,
                       created_at=datetime.now(timezone.utc))
    db.add(user)
    db.commit()
    return user


# --- helper -------------------------------------------------------------------

def test_record_saves_with_the_change_in_one_commit(db_session):
    user = make_user(db_session)
    partner = models.Partner(name="Before", is_published=True)
    db_session.add(partner)
    db_session.commit()

    before = audit.snapshot(partner)
    partner.name = "After"
    audit.record(db_session, user, "update", "partners", partner.id, before=before, after=audit.snapshot(partner))
    db_session.commit()

    row = db_session.query(models.AuditLog).one()
    assert (row.user_id, row.action, row.entity, row.entity_id) == (user.id, "update", "partners", partner.id)
    assert row.before["name"] == "Before" and row.after["name"] == "After"
    assert row.created_at is not None


def test_rollback_discards_both_the_change_and_its_audit_row(db_session):
    user = make_user(db_session)
    partner = models.Partner(name="Kept", is_published=True)
    db_session.add(partner)
    db_session.commit()

    partner.name = "Discarded"
    audit.record(db_session, user, "update", "partners", partner.id, after={"name": "Discarded"})
    db_session.rollback()

    assert db_session.query(models.AuditLog).count() == 0
    assert db_session.get(models.Partner, partner.id).name == "Kept"


def test_secrets_are_redacted_and_values_made_json_safe(db_session):
    audit.record(db_session, None, "create", "users", 1, after={
        "email": "a@example.test", "password": "x", "access_token": "t", "nested": {"client_secret": "s"},
        "when": date(2026, 10, 10), "tags": ("a", "b"),
    })
    db_session.commit()
    after = db_session.query(models.AuditLog).one().after
    assert after["password"] == after["access_token"] == after["nested"]["client_secret"] == audit.REDACTED
    assert after["email"] == "a@example.test"
    assert after["when"] == "2026-10-10" and after["tags"] == ["a", "b"]


def test_snapshot_converts_dates_and_can_exclude_columns(db_session):
    document = models.Document(name="MoU", effective_date=date(2026, 1, 1), is_published=False)
    db_session.add(document)
    db_session.commit()
    snap = audit.snapshot(document, exclude={"storage_key"})
    assert snap["effective_date"] == "2026-01-01"
    assert "storage_key" not in snap and snap["name"] == "MoU"


@pytest.mark.parametrize("action,entity", [("", "partners"), ("update", "")])
def test_record_requires_action_and_entity(db_session, action, entity):
    with pytest.raises(ValueError):
        audit.record(db_session, None, action, entity)


def test_history_survives_when_the_user_row_is_removed(db_session):
    user = make_user(db_session)
    audit.record(db_session, user, "delete", "partners", 3)
    db_session.commit()
    db_session.delete(user)
    db_session.commit()
    assert db_session.query(models.AuditLog).one().user_id is None


# --- GET /audit-logs ------------------------------------------------------------

@pytest.mark.parametrize("role,status", [
    ("public", 403), ("student", 403), ("coordinator", 403), ("staff", 200), ("admin", 200),
])
def test_only_staff_and_admin_can_read_the_log(client, cognito, role, status):
    response = client.get(URL, headers=bearer(token_for(client, role)))
    assert response.status_code == status
    if status == 403:
        assert response.json() == {"detail": "Insufficient permissions"}


def test_reading_the_log_without_a_token_is_401(client):
    response = client.get(URL)
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_the_log_cannot_be_changed_through_the_api(client, cognito, method):
    headers = bearer(token_for(client, "admin"))
    assert getattr(client, method)(URL, headers=headers).status_code == 405
    assert getattr(client, method)(URL + "1", headers=headers).status_code in (404, 405)


def test_list_is_newest_first_with_user_email_and_filters(client, cognito, db_session):
    headers = bearer(token_for(client, "staff"))  # creates the staff user row
    staff = db_session.query(models.User).filter_by(email="staff@example.test").one()
    now = datetime.now(timezone.utc)
    rows = [
        models.AuditLog(user_id=staff.id, action="create", entity="partners", entity_id=1, created_at=now - timedelta(days=3)),
        models.AuditLog(user_id=staff.id, action="update", entity="partners", entity_id=1, created_at=now - timedelta(days=1)),
        models.AuditLog(user_id=None, action="approve", entity="documents", entity_id=9, created_at=now),
    ]
    db_session.add_all(rows)
    db_session.commit()

    body = client.get(URL, headers=headers).json()
    assert [r["action"] for r in body] == ["approve", "update", "create"]
    assert body[1]["user_email"] == "staff@example.test" and body[0]["user_email"] is None

    def actions(**params):
        return [r["action"] for r in client.get(URL, params=params, headers=headers).json()]

    assert actions(entity="partners", entity_id=1) == ["update", "create"]
    assert actions(user_id=staff.id) == ["update", "create"]
    assert actions(action="approve") == ["approve"]
    assert actions(date_from=(now - timedelta(days=2)).date().isoformat()) == ["approve", "update"]
    assert actions(date_to=(now - timedelta(days=2)).date().isoformat()) == ["create"]
    assert actions(limit=1) == ["approve"]
    assert actions(limit=1, offset=1) == ["update"]


@pytest.mark.parametrize("params", [{"date_from": "2026-10-10", "date_to": "2026-10-01"}, {"limit": 0}, {"limit": 501}])
def test_invalid_filters_are_422(client, cognito, params):
    response = client.get(URL, params=params, headers=bearer(token_for(client, "admin")))
    assert response.status_code == 422


# --- migration --------------------------------------------------------------------

def test_v3_migration_adds_audit_logs_to_an_existing_database(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v2.db'}")
    with engine.begin() as c:
        c.exec_driver_sql("CREATE TABLE partners (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, is_published BOOLEAN NOT NULL DEFAULT false)")
        c.exec_driver_sql("INSERT INTO partners (id, name, is_published) VALUES (1, 'Existing', true)")
    migrate(engine)
    migrate(engine)
    with engine.begin() as c:
        assert inspect(c).has_table("audit_logs")
        assert c.execute(text("SELECT name FROM partners WHERE id=1")).scalar_one() == "Existing"
    engine.dispose()
