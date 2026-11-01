"""V4-6 (#99): improvements recorded from feedback (PDCA), their API, and the report figures."""
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError

import models
from database import Base
import migrate_v4_6


# --- schema / migration ------------------------------------------------------

def test_migration_adds_tables_and_runs_twice(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v46.db'}")
    try:
        existing = [t for t in Base.metadata.sorted_tables if t.name not in migrate_v4_6.V4_6_TABLES]
        Base.metadata.create_all(engine, tables=existing)
        migrate_v4_6.migrate(engine)
        migrate_v4_6.migrate(engine)
        names = set(inspect(engine).get_table_names())
        assert set(migrate_v4_6.V4_6_TABLES) <= names
    finally:
        engine.dispose()


def _feedback(db_session, title="f"):
    partner = models.Partner(name=f"P {title}", type="university")
    db_session.add(partner)
    db_session.flush()
    row = models.Feedback(title=title, partner_id=partner.id, status="pending")
    db_session.add(row)
    db_session.flush()
    return row


def test_improvement_status_is_constrained(db_session):
    db_session.add(models.Improvement(title="x", status="maybe", created_at=datetime.now(timezone.utc)))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_deleting_feedback_removes_only_the_link(db_session):
    feedback = _feedback(db_session)
    improvement = models.Improvement(title="Revise course", status="done", created_at=datetime.now(timezone.utc),
                                     feedbacks=[feedback])
    db_session.add(improvement)
    db_session.commit()
    db_session.delete(feedback)
    db_session.commit()
    db_session.refresh(improvement)
    assert improvement.feedbacks == []
    assert db_session.get(models.Improvement, improvement.id) is not None


# --- API ---------------------------------------------------------------------

from tests.test_auth import bearer, cognito, token_for  # noqa: E402,F401

URL = "/api/v1/improvements/"
ROLES = ("student", "coordinator", "staff", "admin")


@pytest.fixture
def tokens(client, cognito):
    return {role: bearer(token_for(client, role)) for role in ROLES}


@pytest.fixture
def scope(db_session, tokens):
    """Coordinator owns partner 'Mine'; feedback 'mine' is in scope, 'other' is not."""
    coordinator = db_session.query(models.User).filter_by(email="coordinator@example.test").one()
    mine = models.Partner(name="Mine", type="university", owner_user_id=coordinator.id)
    other = models.Partner(name="Other", type="company")
    db_session.add_all([mine, other])
    db_session.flush()
    in_scope = models.Feedback(title="mine", partner_id=mine.id, date=date(2025, 2, 1))
    out_scope = models.Feedback(title="other", partner_id=other.id, date=date(2025, 3, 1))
    db_session.add_all([in_scope, out_scope])
    db_session.commit()
    return {"mine": in_scope.id, "other": out_scope.id}


def _create(client, headers, feedback_ids, **extra):
    body = {"title": "Add a lab session", "feedbackIds": feedback_ids, **extra}
    return client.post(URL, json=body, headers=headers)


def test_staff_create_links_feedback_and_writes_audit(client, tokens, scope, db_session):
    response = _create(client, tokens["staff"], [scope["mine"], scope["other"]],
                       status="done", actionDate="2025-04-01", responsible="กรรมการหลักสูตร")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "done"
    assert body["actionDate"] == "2025-04-01"
    assert [f["id"] for f in body["feedbacks"]] == sorted([scope["mine"], scope["other"]])
    log = db_session.query(models.AuditLog).filter_by(entity="improvements").one()
    assert log.action == "create"
    assert sorted(log.after["feedback_ids"]) == sorted([scope["mine"], scope["other"]])


@pytest.mark.parametrize("role,status", [("student", 403), ("coordinator", 201), ("staff", 201), ("admin", 201)])
def test_create_permissions(client, tokens, scope, role, status):
    assert _create(client, tokens[role], [scope["mine"]]).status_code == status


def test_anonymous_is_rejected(client, scope):
    assert client.get(URL).status_code == 401
    assert _create(client, {}, [scope["mine"]]).status_code == 401


def test_coordinator_cannot_link_feedback_outside_scope(client, tokens, scope):
    assert _create(client, tokens["coordinator"], [scope["mine"], scope["other"]]).status_code == 403


def test_coordinator_only_sees_and_edits_own_improvements(client, tokens, scope):
    own = _create(client, tokens["staff"], [scope["mine"]]).json()
    mixed = _create(client, tokens["staff"], [scope["mine"], scope["other"]]).json()
    listed = client.get(URL, headers=tokens["coordinator"]).json()
    assert [row["id"] for row in listed] == [own["id"]]
    assert client.get(f"{URL}{mixed['id']}", headers=tokens["coordinator"]).status_code == 404
    assert client.patch(f"{URL}{mixed['id']}", json={"status": "done"},
                        headers=tokens["coordinator"]).status_code == 404
    response = client.patch(f"{URL}{own['id']}", json={"status": "in_progress"}, headers=tokens["coordinator"])
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    options = client.get(f"{URL}feedback-options", headers=tokens["coordinator"]).json()
    assert [row["id"] for row in options] == [scope["mine"]]


def test_only_staff_and_admin_delete(client, tokens, scope, db_session):
    created = _create(client, tokens["coordinator"], [scope["mine"]]).json()
    assert client.delete(f"{URL}{created['id']}", headers=tokens["coordinator"]).status_code == 403
    assert client.delete(f"{URL}{created['id']}", headers=tokens["admin"]).status_code == 204
    assert db_session.query(models.AuditLog).filter_by(entity="improvements", action="delete").count() == 1


def test_update_relinks_and_clears_optional_fields(client, tokens, scope):
    created = _create(client, tokens["staff"], [scope["mine"]], responsible="A").json()
    response = client.patch(f"{URL}{created['id']}", json={"feedbackIds": [scope["other"]], "responsible": None},
                            headers=tokens["staff"])
    assert response.status_code == 200
    assert [f["id"] for f in response.json()["feedbacks"]] == [scope["other"]]
    assert response.json()["responsible"] is None


@pytest.mark.parametrize("body", [
    {"title": "x", "feedbackIds": []},
    {"title": " ", "feedbackIds": [1]},
    {"title": "x", "feedbackIds": [1], "status": "maybe"},
    {"title": "x", "feedbackIds": [99999]},
])
def test_create_validation(client, tokens, scope, body):
    assert client.post(URL, json=body, headers=tokens["staff"]).status_code == 422


def test_list_filters_by_feedback_status_and_year(client, tokens, scope):
    a = _create(client, tokens["staff"], [scope["mine"]], status="done", actionDate="2025-04-01").json()
    _create(client, tokens["staff"], [scope["other"]], status="planned", actionDate="2024-04-01")
    ids = lambda q: [row["id"] for row in client.get(URL, params=q, headers=tokens["staff"]).json()]
    assert ids({"feedback_id": scope["mine"]}) == [a["id"]]
    assert ids({"status": "done"}) == [a["id"]]
    assert ids({"year": 2025}) == [a["id"]]


def test_feedback_inbox_shows_improvement_count(client, tokens, scope):
    _create(client, tokens["staff"], [scope["mine"]])
    _create(client, tokens["staff"], [scope["mine"], scope["other"]])
    rows = {row["id"]: row for row in client.get("/api/v1/feedback/", headers=tokens["staff"]).json()}
    assert rows[scope["mine"]]["improvementCount"] == 2
    assert rows[scope["other"]]["improvementCount"] == 1


# --- insights figures --------------------------------------------------------

SUMMARY = "/api/v1/insights/summary"


@pytest.fixture
def pdca(db_session):
    """5 feedback in 2025 (+1 in 2024); 2 of the 2025 ones have a done improvement.

    done-1 links f1+f2 (one improvement, two feedback), planned links f3, in-progress links f1,
    and old-done (2024) links the 2024 feedback only."""
    uni = models.Partner(name="Uni", type="university")
    company = models.Partner(name="Co", type="company")
    db_session.add_all([uni, company])
    db_session.flush()
    fb = {name: models.Feedback(title=name, partner_id=(company if name == "f5" else uni).id, date=on)
          for name, on in [("f1", date(2025, 1, 5)), ("f2", date(2025, 2, 5)), ("f3", date(2025, 3, 5)),
                           ("f4", date(2025, 4, 5)), ("f5", date(2025, 5, 5)), ("old", date(2024, 5, 5))]}
    db_session.add_all(fb.values())
    now = datetime(2025, 6, 1, tzinfo=timezone.utc)
    db_session.add_all([
        models.Improvement(title="done-1", status="done", action_date=date(2025, 6, 1), created_at=now,
                           responsible="กรรมการหลักสูตร", feedbacks=[fb["f1"], fb["f2"]]),
        models.Improvement(title="planned", status="planned", action_date=date(2025, 7, 1), created_at=now,
                           feedbacks=[fb["f3"]]),
        models.Improvement(title="in-progress", status="in_progress", created_at=now, feedbacks=[fb["f1"]]),
        models.Improvement(title="old-done", status="done", action_date=date(2024, 6, 1), created_at=now,
                           feedbacks=[fb["old"]]),
    ])
    db_session.commit()


def test_summary_counts_feedback_that_led_to_improvements(client, tokens, pdca):
    body = client.get(SUMMARY, params={"year": 2025}, headers=tokens["staff"]).json()["improvements"]
    assert {r["key"]: r["count"] for r in body["byStatus"]} == {"done": 1, "planned": 1, "in_progress": 1}
    assert body["feedbackTotal"] == 5
    assert body["feedbackWithImprovement"] == 2
    assert [item["title"] for item in body["items"]] == ["planned", "in-progress", "done-1"]
    done = next(item for item in body["items"] if item["title"] == "done-1")
    assert [f["title"] for f in done["feedbacks"]] == ["f1", "f2"]
    assert done["responsible"] == "กรรมการหลักสูตร"


def test_summary_improvements_follow_year_and_stakeholder_filters(client, tokens, pdca):
    old = client.get(SUMMARY, params={"year": 2024}, headers=tokens["staff"]).json()["improvements"]
    assert [item["title"] for item in old["items"]] == ["old-done"]
    assert (old["feedbackTotal"], old["feedbackWithImprovement"]) == (1, 1)
    company = client.get(SUMMARY, params={"year": 2025, "stakeholder_type": "company"},
                         headers=tokens["staff"]).json()["improvements"]
    assert company["items"] == []
    assert (company["feedbackTotal"], company["feedbackWithImprovement"]) == (1, 0)


def test_summary_csv_lists_improvements(client, tokens, pdca):
    text = client.get(f"{SUMMARY}.csv", params={"year": 2025}, headers=tokens["staff"]).text
    assert "การปรับปรุง" in text and "done-1" in text and "มีการปรับปรุงที่เสร็จแล้ว" in text
