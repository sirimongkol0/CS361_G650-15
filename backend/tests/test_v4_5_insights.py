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
