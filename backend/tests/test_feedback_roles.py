"""Issue #101: sender type from role, exchange ownership, replies for the sender,
coordinator scope over all four contexts, auto-review on improvement and summary units."""
from datetime import date

import models
from tests.test_auth import bearer, cognito, token_for  # noqa: F401


def _user(db_session, role):
    return db_session.query(models.User).filter_by(email=f"{role}@example.test").one()


def _code(db_session, model, row_id):
    return db_session.get(model, row_id).code


def _activity(db_session, owner=None):
    row = models.Activity(name="Workshop", is_published=True, owner_user_id=owner)
    db_session.add(row)
    db_session.commit()
    return row


def test_sender_type_follows_role_and_ignores_the_request(client, db_session, cognito):
    activity = _activity(db_session)
    partner_type = db_session.query(models.RespondentType).filter_by(code="partner").one()
    for role, expected in (("student", "student"), ("coordinator", "coordinator")):
        response = client.post("/api/v1/feedback/", headers=bearer(token_for(client, role)), json={
            "title": "t", "comment": "c", "activity_id": activity.id, "respondent_type_id": partner_type.id})
        assert response.status_code == 201, response.text
        row = db_session.get(models.Feedback, response.json()["id"])
        assert (row.respondent_type.code, row.feedback_source.code) == (expected, "web_form")


def test_staff_entering_a_partners_feedback_is_a_manual_entry(client, db_session, cognito):
    activity = _activity(db_session)
    headers = bearer(token_for(client, "staff"))
    partner_type = db_session.query(models.RespondentType).filter_by(code="partner").one()
    own = client.post("/api/v1/feedback/", headers=headers,
                      json={"title": "t", "comment": "c", "activity_id": activity.id}).json()
    on_behalf = client.post("/api/v1/feedback/", headers=headers, json={
        "title": "t", "comment": "c", "activity_id": activity.id, "respondent_type_id": partner_type.id}).json()
    rows = [db_session.get(models.Feedback, body["id"]) for body in (own, on_behalf)]
    assert [(r.respondent_type.code, r.feedback_source.code) for r in rows] == [
        ("staff", "web_form"), ("partner", "manual_entry")]


def test_comment_is_required_and_rating_optional(client, db_session, cognito):
    activity = _activity(db_session)
    headers = bearer(token_for(client, "student"))
    assert client.post("/api/v1/feedback/", headers=headers,
                       json={"title": "t", "comment": "  ", "activity_id": activity.id}).status_code == 422
    response = client.post("/api/v1/feedback/", headers=headers,
                           json={"title": "t", "comment": "Suggestion", "activity_id": activity.id})
    assert response.status_code == 201 and response.json()["rating"] is None


def test_student_cannot_rate_someone_elses_exchange(client, db_session, cognito):
    token = token_for(client, "student")
    me = _user(db_session, "student")
    mine = models.ExchangeStudent(name="Mine (unpublished)", program="x", user_id=me.id)
    other = models.ExchangeStudent(name="Other", program="x", is_published=True)
    db_session.add_all([mine, other])
    db_session.commit()
    body = {"title": "t", "comment": "c"}
    assert client.post("/api/v1/feedback/", headers=bearer(token),
                       json={**body, "exchange_id": mine.id}).status_code == 201
    assert client.post("/api/v1/feedback/", headers=bearer(token),
                       json={**body, "exchange_id": other.id}).status_code == 403


def test_sender_sees_the_staff_reply_in_mine(client, db_session, cognito):
    activity = _activity(db_session)
    student = bearer(token_for(client, "student"))
    created = client.post("/api/v1/feedback/", headers=student,
                          json={"title": "t", "comment": "c", "activity_id": activity.id}).json()
    client.patch(f"/api/v1/feedback/{created['id']}", headers=bearer(token_for(client, "staff")),
                 json={"reply": "Thanks, fixed."})
    mine = client.get("/api/v1/feedback/mine", headers=student).json()
    assert mine[0]["reply"] == "Thanks, fixed." and mine[0]["repliedAt"]


def test_coordinator_reviews_feedback_in_all_four_owned_contexts(client, db_session, cognito):
    headers = bearer(token_for(client, "coordinator"))
    me = _user(db_session, "coordinator").id
    partner = models.Partner(name="P", owner_user_id=me)
    document = models.Document(name="D", owner_user_id=me)
    activity = models.Activity(name="A", owner_user_id=me)
    exchange = models.ExchangeStudent(name="E", program="x", owner_user_id=me)
    foreign = models.Activity(name="Not mine")
    db_session.add_all([partner, document, activity, exchange, foreign])
    db_session.flush()
    feedback = [models.Feedback(title=f"F{i}", date=date(2026, 1, 1), status="pending", **{field: row.id})
                for i, (field, row) in enumerate((("partner_id", partner), ("document_id", document),
                                                   ("activity_id", activity), ("exchange_id", exchange),
                                                   ("activity_id", foreign)))]
    db_session.add_all(feedback)
    db_session.commit()

    rows = client.get("/api/v1/feedback/", headers=headers).json()
    assert sorted(r["title"] for r in rows) == ["F0", "F1", "F2", "F3"]
    assert all("comment" in r and "isPublished" in r for r in rows)
    reviewed = client.patch(f"/api/v1/feedback/{feedback[1].id}", headers=headers,
                            json={"status": "reviewed", "reply": "Thanks"})
    assert reviewed.status_code == 200, reviewed.text
    assert client.patch(f"/api/v1/feedback/{feedback[4].id}", headers=headers,
                        json={"status": "reviewed"}).status_code == 403

    improvement = client.post("/api/v1/improvements/", headers=headers, json={
        "title": "Improve", "feedbackIds": [feedback[0].id, feedback[3].id]})
    assert improvement.status_code == 201, improvement.text
    db_session.expire_all()
    assert [db_session.get(models.Feedback, f.id).status for f in feedback] == [
        "reviewed", "reviewed", "pending", "reviewed", "pending"]


def test_summary_outcomes_carry_their_unit(client, db_session, cognito):
    participants = db_session.query(models.OutcomeType).filter_by(code="participants").one()
    db_session.add(models.Outcome(title="Seminar", outcome_type_id=participants.id, value=45,
                                  occurred_on=date(2026, 3, 1), activity_id=_activity(db_session).id))
    db_session.commit()
    body = client.get("/api/v1/insights/summary?year=2026", headers=bearer(token_for(client, "staff"))).json()
    assert body["outcomesByType"][0]["unit"] == "คน"
