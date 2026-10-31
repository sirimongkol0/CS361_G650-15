"""V4-5 insights: summary figures computed in SQL, checked against a fixture with known counts."""
from datetime import date, timedelta
from decimal import Decimal

import pytest

import models
from tests.test_auth import bearer, cognito, token_for  # noqa: F401

ROLES = ("public", "student", "coordinator", "staff", "admin")
SUMMARY = "/api/v1/insights/summary"


def _lookup(db_session, model, code):
    return db_session.query(model).filter_by(code=code).one().id


@pytest.fixture
def world(db_session):
    """Known data: 3 live partners (2 university, 1 company) + 1 deleted, agreements, activities, outcomes, feedback."""
    today = date.today()
    uni_a = models.Partner(name="Uni A", type="university")
    uni_b = models.Partner(name="Uni B", type="university")
    company = models.Partner(name="Company C", type="company")
    gone = models.Partner(name="Deleted D", type="company", is_deleted=True)
    db_session.add_all([uni_a, uni_b, company, gone])
    db_session.flush()

    db_session.add_all([
        models.Document(name="MOU A", doc_type="mou", status="active", partner_id=uni_a.id,
                        expiry_date=today + timedelta(days=30)),
        models.Document(name="MOA B", doc_type="moa", status="active", partner_id=uni_b.id,
                        expiry_date=today + timedelta(days=200)),
        models.Document(name="MOU C", doc_type="mou", status="expired", partner_id=company.id,
                        expiry_date=today - timedelta(days=10)),
        models.Document(name="Template", doc_type="template", status="active",
                        expiry_date=today + timedelta(days=5)),
        models.Document(name="Deleted MOU", doc_type="mou", status="active", partner_id=uni_a.id,
                        expiry_date=today + timedelta(days=5), is_deleted=True),
    ])
    activities = [
        models.Activity(name="Jan 1", date=date(2025, 1, 10), partner_id=uni_a.id),
        models.Activity(name="Jan 2", date=date(2025, 1, 20), partner_id=company.id),
        models.Activity(name="Mar", date=date(2025, 3, 5), partner_id=uni_b.id),
        models.Activity(name="Other year", date=date(2024, 6, 1), partner_id=uni_a.id),
        models.Activity(name="Deleted", date=date(2025, 1, 15), partner_id=uni_a.id, is_deleted=True),
    ]
    db_session.add_all(activities)
    db_session.flush()

    participants = _lookup(db_session, models.OutcomeType, "participants")
    funding = _lookup(db_session, models.OutcomeType, "funding")
    db_session.add_all([
        models.Outcome(title="P1", outcome_type_id=participants, value=Decimal(30),
                       occurred_on=date(2025, 1, 10), activity_id=activities[0].id, partner_id=uni_a.id),
        models.Outcome(title="P2", outcome_type_id=participants, value=Decimal(20),
                       occurred_on=date(2025, 3, 5), activity_id=activities[2].id, partner_id=uni_b.id),
        models.Outcome(title="F1", outcome_type_id=funding, value=Decimal(50000),
                       occurred_on=date(2025, 2, 1), partner_id=company.id),
        models.Outcome(title="Old", outcome_type_id=funding, value=Decimal(1),
                       occurred_on=date(2024, 2, 1), partner_id=uni_a.id),
        models.Outcome(title="Gone", outcome_type_id=participants, value=Decimal(99),
                       occurred_on=date(2025, 1, 1), partner_id=uni_a.id, is_deleted=True),
    ])

    web = _lookup(db_session, models.FeedbackSource, "web_form")
    coop = _lookup(db_session, models.FeedbackSource, "coop_system")
    student = _lookup(db_session, models.RespondentType, "student")
    partner_rt = _lookup(db_session, models.RespondentType, "partner")
    db_session.add_all([
        models.Feedback(title="f1", rating=5, status="reviewed", date=date(2025, 1, 11), partner_id=uni_a.id,
                        feedback_source_id=web, respondent_type_id=student),
        models.Feedback(title="f2", rating=4, status="pending", date=date(2025, 1, 21), partner_id=company.id,
                        feedback_source_id=coop, respondent_type_id=student),
        models.Feedback(title="f3", rating=4, status="pending", date=date(2025, 3, 6), partner_id=uni_b.id,
                        feedback_source_id=web, respondent_type_id=partner_rt),
        models.Feedback(title="old", rating=1, status="reviewed", date=date(2024, 5, 1), partner_id=uni_a.id,
                        feedback_source_id=web, respondent_type_id=student),
    ])
    db_session.commit()


def _counts(rows, key="key"):
    return {row[key]: row["count"] for row in rows}


@pytest.fixture
def staff(client, cognito):
    return bearer(token_for(client, "staff"))


# --- figures ------------------------------------------------------------------

def test_summary_counts_live_partners_by_stakeholder_type(client, world, staff):
    body = client.get(SUMMARY, headers=staff).json()
    assert _counts(body["partnersByType"]) == {"university": 2, "company": 1}


def test_summary_counts_agreements_by_status_ignoring_templates_and_deleted(client, world, staff):
    body = client.get(SUMMARY, headers=staff).json()
    assert _counts(body["agreementsByStatus"]) == {"active": 2, "expired": 1}


def test_summary_lists_agreements_expiring_within_window(client, world, staff):
    body = client.get(SUMMARY, headers=staff).json()
    assert body["expiringWithinDays"] == 90
    assert [row["name"] for row in body["agreementsExpiring"]] == ["MOU A"]
    assert body["agreementsExpiring"][0]["partnerName"] == "Uni A"


def test_summary_counts_activities_per_month(client, world, staff):
    body = client.get(SUMMARY, headers=staff).json()
    assert _counts(body["activitiesByMonth"], "month") == {"2024-06": 1, "2025-01": 2, "2025-03": 1}


def test_summary_counts_and_totals_outcomes_by_type(client, world, staff):
    rows = {row["key"]: row for row in client.get(SUMMARY, headers=staff).json()["outcomesByType"]}
    assert (rows["participants"]["count"], rows["participants"]["totalValue"]) == (2, 50)
    assert (rows["funding"]["count"], rows["funding"]["totalValue"]) == (2, 50001)
    assert rows["funding"]["label"] == "ทุนหรืองบประมาณ"


def test_summary_breaks_feedback_down_by_source_respondent_rating_and_status(client, world, staff):
    body = client.get(SUMMARY, headers=staff).json()
    assert _counts(body["feedbackBySource"]) == {"web_form": 3, "coop_system": 1}
    assert _counts(body["feedbackByRespondentType"]) == {"student": 3, "partner": 1}
    assert _counts(body["feedbackByRating"]) == {1: 1, 4: 2, 5: 1}
    assert _counts(body["feedbackByStatus"]) == {"reviewed": 2, "pending": 2}
    assert body["feedbackAverageRating"] == 3.5


# --- filters ------------------------------------------------------------------

def test_year_filter_limits_every_dated_figure(client, world, staff):
    body = client.get(SUMMARY, params={"year": 2025}, headers=staff).json()
    assert _counts(body["activitiesByMonth"], "month") == {"2025-01": 2, "2025-03": 1}
    assert {r["key"]: r["count"] for r in body["outcomesByType"]} == {"participants": 2, "funding": 1}
    assert _counts(body["feedbackByStatus"]) == {"reviewed": 1, "pending": 2}
    assert body["filters"] == {"dateFrom": "2025-01-01", "dateTo": "2025-12-31", "stakeholderType": None}


def test_date_range_filter_is_inclusive(client, world, staff):
    body = client.get(SUMMARY, params={"date_from": "2025-01-20", "date_to": "2025-03-05"}, headers=staff).json()
    assert _counts(body["activitiesByMonth"], "month") == {"2025-01": 1, "2025-03": 1}


def test_stakeholder_type_filter_limits_to_partners_of_that_type(client, world, staff):
    body = client.get(SUMMARY, params={"stakeholder_type": "university"}, headers=staff).json()
    assert _counts(body["partnersByType"]) == {"university": 2}
    assert _counts(body["agreementsByStatus"]) == {"active": 2}
    assert _counts(body["activitiesByMonth"], "month") == {"2024-06": 1, "2025-01": 1, "2025-03": 1}
    assert _counts(body["feedbackBySource"]) == {"web_form": 3}


def test_inverted_date_range_is_rejected(client, staff):
    response = client.get(SUMMARY, params={"date_from": "2025-02-01", "date_to": "2025-01-01"}, headers=staff)
    assert response.status_code == 422


def test_year_cannot_be_combined_with_a_date_range(client, staff):
    response = client.get(SUMMARY, params={"year": 2025, "date_from": "2025-02-01"}, headers=staff)
    assert response.status_code == 422


def test_empty_database_returns_empty_figures(client, staff):
    body = client.get(SUMMARY, headers=staff).json()
    assert body["partnersByType"] == [] and body["activitiesByMonth"] == []
    assert body["feedbackAverageRating"] is None


# --- permissions --------------------------------------------------------------

def test_summary_requires_sign_in(client):
    assert client.get(SUMMARY).status_code == 401


@pytest.mark.parametrize("role,status", [
    ("public", 403), ("student", 403), ("coordinator", 403), ("staff", 200), ("admin", 200),
])
def test_summary_is_for_staff_and_admin_only(client, cognito, role, status):
    assert client.get(SUMMARY, headers=bearer(token_for(client, role))).status_code == status


# --- partner continuity -------------------------------------------------------

def _partner_id(db_session, name):
    return db_session.query(models.Partner).filter_by(name=name).one().id


def test_partner_timeline_counts_each_kind_per_year(client, world, staff, db_session):
    uni_a = _partner_id(db_session, "Uni A")
    db_session.query(models.Document).filter_by(name="MOU A").one().effective_date = date(2024, 3, 1)
    db_session.commit()

    body = client.get(f"/api/v1/insights/partners/{uni_a}", headers=staff).json()
    assert body["partner"] == {"id": uni_a, "name": "Uni A", "type": "university"}
    assert body["timeline"] == [
        {"year": 2024, "agreements": 1, "activities": 1, "outcomes": 1, "feedback": 1},
        {"year": 2025, "agreements": 0, "activities": 1, "outcomes": 1, "feedback": 1},
    ]
    assert body["totals"] == {"agreements": 1, "activities": 2, "outcomes": 2, "feedback": 2}


def test_partner_timeline_404_for_missing_or_deleted_partner(client, world, staff, db_session):
    assert client.get("/api/v1/insights/partners/99999", headers=staff).status_code == 404
    gone = _partner_id(db_session, "Deleted D")
    assert client.get(f"/api/v1/insights/partners/{gone}", headers=staff).status_code == 404


@pytest.mark.parametrize("role,status", [
    ("public", 403), ("student", 403), ("coordinator", 403), ("staff", 200), ("admin", 200),
])
def test_partner_timeline_is_for_staff_and_admin_only(client, world, cognito, db_session, role, status):
    uni_a = _partner_id(db_session, "Uni A")
    response = client.get(f"/api/v1/insights/partners/{uni_a}", headers=bearer(token_for(client, role)))
    assert response.status_code == status


# --- role-scoped dashboard figures ----------------------------------------------

ME = "/api/v1/insights/me"


def _user_id(db_session, role):
    return db_session.query(models.User).filter_by(email=f"{role}@example.test").one().id


def test_coordinator_sees_only_their_own_records(client, cognito, db_session):
    headers = bearer(token_for(client, "coordinator"))
    me = _user_id(db_session, "coordinator")
    mine = models.Partner(name="Mine", type="university", owner_user_id=me)
    theirs = models.Partner(name="Theirs", type="university", owner_user_id=None)
    db_session.add_all([mine, theirs])
    db_session.flush()
    my_activity = models.Activity(name="My event", date=date(2025, 5, 1), owner_user_id=me, partner_id=mine.id)
    db_session.add_all([
        my_activity,
        models.Activity(name="Old event", date=date(2024, 5, 1), owner_user_id=me),
        models.Activity(name="Their event", date=date(2025, 5, 2), partner_id=theirs.id),
        models.Activity(name="My deleted", date=date(2025, 5, 3), owner_user_id=me, is_deleted=True),
    ])
    db_session.flush()
    db_session.add_all([
        models.Feedback(title="on mine", status="pending", partner_id=mine.id),
        models.Feedback(title="on my activity", status="reviewed", activity_id=my_activity.id),
        models.Feedback(title="on theirs", status="pending", partner_id=theirs.id),
    ])
    db_session.commit()

    body = client.get(ME, headers=headers).json()
    assert body["role"] == "coordinator"
    assert body["counts"] == {"partners": 1, "activities": 2, "outcomes": 0, "feedback": 2, "feedbackPending": 1}
    assert [a["name"] for a in body["recentActivities"]] == ["My event", "Old event"]


def test_student_sees_their_feedback_and_exchange(client, cognito, db_session):
    headers = bearer(token_for(client, "student"))
    me = _user_id(db_session, "student")
    partner = models.Partner(name="P", type="university")
    db_session.add(partner)
    db_session.flush()
    db_session.add_all([
        models.Feedback(title="mine", status="pending", partner_id=partner.id, submitted_by_user_id=me),
        models.Feedback(title="other", status="pending", partner_id=partner.id),
        models.ExchangeStudent(name="Me abroad", program="แลกเปลี่ยน", status="กำลังดำเนินการ", user_id=me),
        models.ExchangeStudent(name="Someone else", program="แลกเปลี่ยน"),
    ])
    db_session.commit()

    body = client.get(ME, headers=headers).json()
    assert body["role"] == "student"
    assert body["counts"] == {"feedbackSubmitted": 1}
    assert [e["name"] for e in body["exchange"]] == ["Me abroad"]


@pytest.mark.parametrize("role,status", [
    ("public", 403), ("student", 200), ("coordinator", 200), ("staff", 403), ("admin", 403),
])
def test_me_figures_are_for_coordinators_and_students(client, cognito, role, status):
    assert client.get(ME, headers=bearer(token_for(client, role))).status_code == status
    assert client.get(ME).status_code == 401


# --- report CSV -----------------------------------------------------------------

def test_summary_csv_has_one_row_per_figure_and_follows_filters(client, world, staff):
    response = client.get("/api/v1/insights/summary.csv", params={"year": 2025}, headers=staff)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "insights-summary" in response.headers["content-disposition"]
    lines = response.content.decode("utf-8-sig").splitlines()
    assert lines[0] == "หมวด,รหัส,รายการ,จำนวน,มูลค่ารวม"
    assert "กิจกรรมรายเดือน,2025-01,2025-01,2," in lines
    assert "กิจกรรมรายเดือน,2024-06,2024-06,1," not in lines
    assert "ผลลัพธ์ตามประเภท,funding,ทุนหรืองบประมาณ,1,50000.0" in lines


def test_summary_csv_escapes_formula_like_values(client, db_session, staff):
    db_session.add(models.Partner(name="X", type="=HYPERLINK(1)"))
    db_session.commit()
    body = client.get("/api/v1/insights/summary.csv", headers=staff).content.decode("utf-8-sig")
    assert "'=HYPERLINK(1)" in body


@pytest.mark.parametrize("role", ["public", "student", "coordinator"])
def test_summary_csv_is_for_staff_and_admin_only(client, cognito, role):
    response = client.get("/api/v1/insights/summary.csv", headers=bearer(token_for(client, role)))
    assert response.status_code == 403


# --- dashboard extras -------------------------------------------------------------

def test_summary_ranks_top_partners_by_agreements_plus_activities(client, world, staff):
    rows = client.get(SUMMARY, headers=staff).json()["topPartners"]
    assert [(r["name"], r["agreements"], r["activities"], r["total"]) for r in rows] == [
        ("Uni A", 1, 2, 3), ("Company C", 1, 1, 2), ("Uni B", 1, 1, 2),
    ]


def test_top_partners_follow_the_year_filter(client, world, staff):
    rows = client.get(SUMMARY, params={"year": 2024}, headers=staff).json()["topPartners"]
    assert [(r["name"], r["activities"]) for r in rows] == [("Uni A", 1)]


def test_summary_counts_agreements_per_effective_year(client, world, staff, db_session):
    for name, year in [("MOU A", 2023), ("MOA B", 2025), ("MOU C", 2025)]:
        db_session.query(models.Document).filter_by(name=name).one().effective_date = date(year, 1, 1)
    db_session.commit()
    body = client.get(SUMMARY, params={"year": 2025}, headers=staff).json()
    assert body["agreementsByYear"] == [{"year": 2023, "count": 1}, {"year": 2025, "count": 2}]


# --- activity report CSV ------------------------------------------------------------

def _activity_with_results(db_session, owner_id=None):
    activity = models.Activity(name="Workshop", date=date(2025, 4, 2), status="เสร็จสิ้น", owner_user_id=owner_id)
    db_session.add(activity)
    db_session.flush()
    participants = _lookup(db_session, models.OutcomeType, "participants")
    db_session.add_all([
        models.Outcome(title="ผู้เข้าร่วม", outcome_type_id=participants, value=Decimal(40), activity_id=activity.id,
                       occurred_on=date(2025, 4, 2)),
        models.Outcome(title="Deleted", outcome_type_id=participants, value=Decimal(1), activity_id=activity.id,
                       is_deleted=True),
        models.Feedback(title="ดีมาก", rating=5, status="reviewed", date=date(2025, 4, 3), activity_id=activity.id,
                        comment="=cmd"),
    ])
    db_session.commit()
    return activity.id


def test_activity_report_csv_lists_the_activity_its_outcomes_and_feedback(client, db_session, staff):
    activity_id = _activity_with_results(db_session)
    response = client.get(f"/api/v1/insights/activities/{activity_id}.csv", headers=staff)
    assert response.status_code == 200
    assert f"activity-{activity_id}-report" in response.headers["content-disposition"]
    lines = response.content.decode("utf-8-sig").splitlines()
    assert lines[0] == "หมวด,รายการ,วันที่,ค่า,หน่วย,สถานะ,หมายเหตุ"
    assert lines[1] == "กิจกรรม,Workshop,2025-04-02,,,เสร็จสิ้น,"
    assert "ผลลัพธ์,ผู้เข้าร่วม,2025-04-02,40.00,คน,," in lines
    assert "Feedback,ดีมาก,2025-04-03,5,คะแนน,reviewed,'=cmd" in lines
    assert not any("Deleted" in line for line in lines)


def test_activity_report_404_for_missing_activity(client, staff):
    assert client.get("/api/v1/insights/activities/99999.csv", headers=staff).status_code == 404


def test_coordinator_exports_only_their_own_activity(client, cognito, db_session):
    headers = bearer(token_for(client, "coordinator"))
    mine = _activity_with_results(db_session, owner_id=_user_id(db_session, "coordinator"))
    theirs = _activity_with_results(db_session)
    assert client.get(f"/api/v1/insights/activities/{mine}.csv", headers=headers).status_code == 200
    assert client.get(f"/api/v1/insights/activities/{theirs}.csv", headers=headers).status_code == 403


@pytest.mark.parametrize("role", ["public", "student"])
def test_activity_report_rejects_public_and_students(client, cognito, db_session, role):
    activity_id = _activity_with_results(db_session)
    response = client.get(f"/api/v1/insights/activities/{activity_id}.csv", headers=bearer(token_for(client, role)))
    assert response.status_code == 403


def test_stakeholder_filter_includes_records_linked_only_through_their_activity(client, db_session, staff):
    uni = models.Partner(name="U", type="university")
    company = models.Partner(name="C", type="private_company")
    db_session.add_all([uni, company])
    db_session.flush()
    uni_event = models.Activity(name="U event", date=date(2025, 1, 1), partner_id=uni.id)
    company_event = models.Activity(name="C event", date=date(2025, 1, 2), partner_id=company.id)
    db_session.add_all([uni_event, company_event])
    db_session.flush()
    participants = _lookup(db_session, models.OutcomeType, "participants")
    db_session.add_all([
        models.Outcome(title="via activity", outcome_type_id=participants, activity_id=uni_event.id),
        models.Outcome(title="other type", outcome_type_id=participants, activity_id=company_event.id),
        models.Feedback(title="via activity", status="pending", activity_id=uni_event.id),
        models.Feedback(title="other type", status="pending", activity_id=company_event.id),
    ])
    db_session.commit()

    body = client.get(SUMMARY, params={"stakeholder_type": "university"}, headers=staff).json()
    assert {r["key"]: r["count"] for r in body["outcomesByType"]} == {"participants": 1}
    assert _counts(body["feedbackByStatus"]) == {"pending": 1}


# --- dormant partners ------------------------------------------------------------

def test_summary_lists_partners_with_a_live_agreement_but_no_recent_activity(client, db_session, staff):
    today = date.today()
    quiet = models.Partner(name="Quiet", type="university")
    busy = models.Partner(name="Busy", type="university")
    expired_only = models.Partner(name="Expired only", type="university")
    db_session.add_all([quiet, busy, expired_only])
    db_session.flush()
    db_session.add_all([
        models.Document(name="Q", doc_type="mou", status="active", partner_id=quiet.id,
                        expiry_date=today + timedelta(days=300)),
        models.Document(name="B", doc_type="moa", status="active", partner_id=busy.id, expiry_date=None),
        models.Document(name="E", doc_type="mou", status="expired", partner_id=expired_only.id,
                        expiry_date=today - timedelta(days=1)),
        models.Activity(name="old", date=today - timedelta(days=500), partner_id=quiet.id),
        models.Activity(name="recent", date=today - timedelta(days=30), partner_id=busy.id),
    ])
    db_session.commit()

    body = client.get(SUMMARY, headers=staff).json()
    assert body["dormantWithinDays"] == 365
    assert [(p["name"], p["lastActivityDate"]) for p in body["dormantPartners"]] == [
        ("Quiet", (today - timedelta(days=500)).isoformat()),
    ]


def test_recent_outcome_or_feedback_keeps_a_partner_off_the_dormant_list(client, db_session, staff):
    today = date.today()
    partner = models.Partner(name="Has feedback", type="university")
    db_session.add(partner)
    db_session.flush()
    db_session.add_all([
        models.Document(name="D", doc_type="mou", status="active", partner_id=partner.id),
        models.Feedback(title="f", status="pending", partner_id=partner.id, date=today - timedelta(days=10)),
    ])
    db_session.commit()
    assert client.get(SUMMARY, headers=staff).json()["dormantPartners"] == []


def test_partner_timeline_counts_outcomes_and_feedback_linked_through_its_activities(client, db_session, staff):
    partner = models.Partner(name="P", type="university")
    db_session.add(partner)
    db_session.flush()
    event = models.Activity(name="E", date=date(2025, 3, 1), partner_id=partner.id)
    db_session.add(event)
    db_session.flush()
    participants = _lookup(db_session, models.OutcomeType, "participants")
    db_session.add_all([
        models.Outcome(title="via activity", outcome_type_id=participants, activity_id=event.id,
                       occurred_on=date(2025, 3, 1)),
        models.Feedback(title="via activity", status="pending", activity_id=event.id, date=date(2025, 3, 2)),
    ])
    db_session.commit()

    body = client.get(f"/api/v1/insights/partners/{partner.id}", headers=staff).json()
    assert body["timeline"] == [{"year": 2025, "agreements": 0, "activities": 1, "outcomes": 1, "feedback": 1}]
    assert body["totals"] == {"agreements": 0, "activities": 1, "outcomes": 1, "feedback": 1}
