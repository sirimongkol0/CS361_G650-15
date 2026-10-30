"""V4-3 feedback submission, private views, inbox filters and response privacy."""
from datetime import date

import models
from tests.test_auth import bearer, cognito, token_for  # noqa: F401


def _activity(db_session, name):
    row = models.Activity(name=name, is_published=True)
    db_session.add(row)
    db_session.commit()
    return row


def _submission_payload(db_session, activity, title="Useful feedback"):
    respondent = db_session.query(models.RespondentType).filter_by(code="student").one()
    return {
        "title": title,
        "respondent_type_id": respondent.id,
        "activity_id": activity.id,
        "rating": 4,
        "comment": "Please keep this session.",
    }


def test_feedback_submission_requires_a_signed_in_stakeholder(client, db_session, cognito):
    activity = _activity(db_session, "Workshop")
    payload = _submission_payload(db_session, activity)

    assert client.post("/api/v1/feedback/", json=payload).status_code == 401
    public_headers = bearer(token_for(client, "public"))
    assert client.post("/api/v1/feedback/", json=payload, headers=public_headers).status_code == 403


def test_student_submission_is_private_and_only_visible_in_mine(client, db_session, cognito):
    activity = _activity(db_session, "Workshop")
    headers = bearer(token_for(client, "student"))
    response = client.post(
        "/api/v1/feedback/", json=_submission_payload(db_session, activity), headers=headers
    )
    assert response.status_code == 201, response.text
    submitted = response.json()
    assert submitted["status"] == "pending" and submitted["isPublished"] is False
    assert not {"submitted_by_user_id", "submittedByUserId", "email", "reply", "repliedByUserId"} & submitted.keys()

    mine = client.get("/api/v1/feedback/mine", headers=headers)
    assert mine.status_code == 200
    assert [row["id"] for row in mine.json()] == [submitted["id"]]
    assert client.get("/api/v1/feedback/").json() == []

    row = db_session.query(models.Feedback).filter_by(id=submitted["id"]).one()
    source = db_session.get(models.FeedbackSource, row.feedback_source_id)
    assert source.code == "web_form"
    assert row.submitted_by_user_id is not None
    log = db_session.query(models.AuditLog).filter_by(entity="feedbacks", entity_id=row.id).one()
    assert log.action == "create"


def test_feedback_mine_is_scoped_and_manager_filters_inbox(client, db_session, cognito):
    workshop = _activity(db_session, "Workshop")
    seminar = _activity(db_session, "Seminar")
    student_headers = bearer(token_for(client, "student"))
    submitted = client.post(
        "/api/v1/feedback/",
        json=_submission_payload(db_session, workshop, "Workshop feedback"),
        headers=student_headers,
    )
    assert submitted.status_code == 201, submitted.text
    coordinator_headers = bearer(token_for(client, "coordinator"))
    assert client.get("/api/v1/feedback/mine", headers=coordinator_headers).json() == []

    # Add a second row so the activity/date/status filters must exclude it.
    respondent = db_session.query(models.RespondentType).filter_by(code="student").one()
    source = db_session.query(models.FeedbackSource).filter_by(code="web_form").one()
    db_session.add(models.Feedback(
        title="Older seminar feedback", activity_id=seminar.id,
        respondent_type_id=respondent.id, feedback_source_id=source.id,
        date=date(2025, 1, 1), status="reviewed", is_published=False,
    ))
    db_session.commit()

    staff_headers = bearer(token_for(client, "staff"))
    response = client.get("/api/v1/feedback/", params={
        "feedback_source_id": source.id,
        "respondent_type_id": respondent.id,
        "activity_id": workshop.id,
        "status": "pending",
        "date_from": "2026-01-01",
        "date_to": "2026-12-31",
    }, headers=staff_headers)
    assert response.status_code == 200, response.text
    assert [row["title"] for row in response.json()] == ["Workshop feedback"]
    assert response.json()[0]["source"] == "web_form"


def test_public_filtered_feedback_never_returns_unpublished_or_sender_identity(client, db_session):
    activity = _activity(db_session, "Workshop")
    hidden = models.Feedback(
        title="Private submission", activity_id=activity.id,
        date=date(2026, 5, 1), status="pending", is_published=False,
        source="sender@example.test",
    )
    db_session.add(hidden)
    db_session.commit()

    response = client.get("/api/v1/feedback/", params={"status": "pending", "activity_id": activity.id})
    assert response.status_code == 200
    assert response.json() == []


def test_admin_manages_feedback_lookups_and_changes_are_audited(client, db_session, cognito):
    assert client.get("/api/v1/feedback/lookups").status_code == 401
    staff_headers = bearer(token_for(client, "staff"))
    assert client.get("/api/v1/feedback/lookups", headers=staff_headers).status_code == 403

    admin_headers = bearer(token_for(client, "admin"))
    response = client.post("/api/v1/feedback/lookups/respondent-types", headers=admin_headers,
                           json={"code": "industry_guest", "name_th": "ผู้เชี่ยวชาญภาคอุตสาหกรรม", "sort_order": 10})
    assert response.status_code == 201, response.text
    created = response.json()
    assert created["is_active"] is True

    response = client.patch(f"/api/v1/feedback/lookups/respondent-types/{created['id']}",
                            headers=admin_headers, json={"is_active": False, "name_th": "ผู้เชี่ยวชาญ"})
    assert response.status_code == 200, response.text
    assert response.json()["is_active"] is False
    assert created["id"] not in [row["id"] for row in client.get("/api/v1/feedback/respondent-types").json()]

    logs = db_session.query(models.AuditLog).filter_by(entity="respondent_types", entity_id=created["id"]).all()
    assert [row.action for row in logs] == ["create", "update"]
