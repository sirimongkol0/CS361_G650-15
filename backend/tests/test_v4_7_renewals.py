"""V4-7 renewals: chains of agreements, the decision record, and the renewal figures in insights."""
from datetime import date, timedelta

import pytest

import models
from tests.test_auth import bearer, cognito, token_for  # noqa: F401

ROLES = ("public", "student", "coordinator", "staff", "admin")
SUMMARY = "/api/v1/insights/summary"


def _decide(client, headers, doc_id, decision="renew", reason="ยังมีนักศึกษาแลกเปลี่ยนต่อเนื่อง"):
    return client.post(f"/api/v1/renewals/documents/{doc_id}/decision",
                       json={"decision": decision, "reason": reason}, headers=headers)


@pytest.fixture
def staff(client, cognito):
    return bearer(token_for(client, "staff"))


@pytest.fixture
def world(db_session):
    """Uni A: an active MOU expiring in 30 days with a scope item and one activity under it.
    Uni B: an expired MOA, and a company with an active MOU expiring in 60 days."""
    today = date.today()
    uni_a = models.Partner(name="Uni A", type="university")
    uni_b = models.Partner(name="Uni B", type="university")
    company = models.Partner(name="Company C", type="company")
    db_session.add_all([uni_a, uni_b, company])
    db_session.flush()
    mou_a = models.Document(name="MOU A", doc_type="mou", status="active", partner_id=uni_a.id,
                            effective_date=today - timedelta(days=1000), expiry_date=today + timedelta(days=30),
                            signer_our="คณบดี", scope_level="faculty", cstu_status="keep")
    mou_a.scope_items = [models.DocumentScopeItem(position=0, text="แลกเปลี่ยนนักศึกษา")]
    moa_b = models.Document(name="MOA B", doc_type="moa", status="expired", partner_id=uni_b.id,
                            effective_date=today - timedelta(days=800), expiry_date=today - timedelta(days=10))
    mou_c = models.Document(name="MOU C", doc_type="mou", status="active", partner_id=company.id,
                            effective_date=today - timedelta(days=300), expiry_date=today + timedelta(days=60))
    draft = models.Document(name="Draft D", doc_type="mou", status="draft", partner_id=company.id)
    db_session.add_all([mou_a, moa_b, mou_c, draft])
    db_session.flush()
    db_session.add(models.Activity(name="Exchange", date=today - timedelta(days=20), partner_id=uni_a.id,
                                   mou_document_id=mou_a.id))
    db_session.commit()
    return {"uni_a": uni_a.id, "uni_b": uni_b.id, "company": company.id,
            "mou_a": mou_a.id, "moa_b": moa_b.id, "mou_c": mou_c.id, "draft": draft.id}


# --- decision and renewal draft -------------------------------------------------

def test_renew_creates_a_draft_copy_pointing_back(client, world, staff, db_session):
    response = _decide(client, staff, world["mou_a"])
    assert response.status_code == 201
    body = response.json()
    assert body["document"]["decision"] == "renew"
    assert body["document"]["reason"] == "ยังมีนักศึกษาแลกเปลี่ยนต่อเนื่อง"
    assert body["document"]["decidedAt"] is not None
    new = db_session.get(models.Document, body["renewal"]["id"])
    assert (new.renews_document_id, new.status, new.is_published) == (world["mou_a"], "draft", False)
    assert (new.name, new.partner_id, new.signer_our, new.scope_level) == ("MOU A", world["uni_a"], "คณบดี", "faculty")
    assert new.effective_date is None and new.expiry_date is None and new.storage_key is None
    assert [item.text for item in new.scope_items] == ["แลกเปลี่ยนนักศึกษา"]


def test_terminate_records_the_decision_without_a_draft(client, world, staff):
    body = _decide(client, staff, world["mou_c"], "terminate", "ไม่มีกิจกรรมร่วม").json()
    assert body["renewal"] is None and body["document"]["decision"] == "terminate"


def test_decision_is_audited(client, world, staff, db_session):
    renewal_id = _decide(client, staff, world["mou_a"], "revise").json()["renewal"]["id"]
    logs = db_session.query(models.AuditLog).filter_by(entity="documents").all()
    actions = {(log.action, log.entity_id) for log in logs}
    assert {("renewal_decision", world["mou_a"]), ("create", renewal_id)} <= actions


def test_decision_can_only_be_recorded_once(client, world, staff):
    assert _decide(client, staff, world["mou_a"]).status_code == 201
    assert _decide(client, staff, world["mou_a"], "terminate").status_code == 409


def test_drafts_cannot_be_renewed_and_unknown_agreements_404(client, world, staff):
    assert _decide(client, staff, world["draft"]).status_code == 409
    assert _decide(client, staff, 99999).status_code == 404


@pytest.mark.parametrize("payload", [
    {"decision": "renew", "reason": "  "},
    {"decision": "extend", "reason": "x"},
    {"decision": "renew"},
])
def test_invalid_decisions_are_rejected(client, world, staff, payload):
    response = client.post(f"/api/v1/renewals/documents/{world['mou_a']}/decision", json=payload, headers=staff)
    assert response.status_code == 422


# --- chain ---------------------------------------------------------------------

def test_chain_runs_from_first_version_to_current(client, world, staff, db_session):
    second = _decide(client, staff, world["mou_a"]).json()["renewal"]["id"]
    db_session.get(models.Document, second).status = "active"
    db_session.commit()
    third = _decide(client, staff, second, "revise", "ปรับขอบเขต").json()["renewal"]["id"]

    body = client.get(f"/api/v1/renewals/partners/{world['uni_a']}", headers=staff).json()
    assert [[v["id"] for v in chain] for chain in body["chains"]] == [[world["mou_a"], second, third]]
    assert [v["decision"] for v in body["chains"][0]] == ["renew", "revise", None]


def test_unrenewed_agreements_are_chains_of_one(client, world, staff):
    body = client.get(f"/api/v1/renewals/partners/{world['company']}", headers=staff).json()
    assert sorted(len(chain) for chain in body["chains"]) == [1, 1]


def test_chain_404_for_missing_partner(client, staff):
    assert client.get("/api/v1/renewals/partners/99999", headers=staff).status_code == 404


# --- permissions ---------------------------------------------------------------

@pytest.mark.parametrize("role,status", [
    ("public", 403), ("student", 403), ("coordinator", 403), ("staff", 201), ("admin", 201),
])
def test_only_staff_and_admin_record_decisions(client, world, cognito, role, status):
    assert _decide(client, bearer(token_for(client, role)), world["mou_a"]).status_code == status


@pytest.mark.parametrize("role,status", [
    ("public", 403), ("student", 403), ("coordinator", 403), ("staff", 200), ("admin", 200),
])
def test_only_staff_and_admin_see_chains(client, world, cognito, role, status):
    headers = bearer(token_for(client, role))
    assert client.get(f"/api/v1/renewals/partners/{world['uni_a']}", headers=headers).status_code == status


def test_renewal_routes_require_sign_in(client, world):
    assert _decide(client, {}, world["mou_a"]).status_code == 401
    assert client.get(f"/api/v1/renewals/partners/{world['uni_a']}").status_code == 401


# --- insights --------------------------------------------------------------------

def _expiring(client, staff):
    return [row["name"] for row in client.get(SUMMARY, headers=staff).json()["agreementsExpiring"]]


def test_renewed_agreement_is_no_longer_expiring(client, world, staff):
    assert _expiring(client, staff) == ["MOU A", "MOU C"]
    _decide(client, staff, world["mou_a"])
    assert _expiring(client, staff) == ["MOU C"]


def test_terminated_agreement_no_longer_counts_as_live_for_dormant_partners(client, world, staff):
    dormant = lambda: [p["name"] for p in client.get(SUMMARY, headers=staff).json()["dormantPartners"]]  # noqa: E731
    assert dormant() == ["Company C"]
    _decide(client, staff, world["mou_c"], "terminate", "ไม่มีกิจกรรมร่วม")
    assert dormant() == []
    assert _expiring(client, staff) == ["MOU A"]


def test_renewal_and_activation_rates_match_the_fixture(client, world, staff):
    figures = client.get(SUMMARY, headers=staff).json()["renewals"]
    # Live or past agreements: MOU A, MOA B, MOU C (the draft does not count); only MOU A has an activity.
    # Only the expired MOA B has come up for renewal, and it was not renewed.
    assert figures == {"due": 1, "renewed": 0, "renewalRate": 0.0,
                       "agreements": 3, "activated": 1, "activationRate": 0.3333}

    _decide(client, staff, world["mou_a"])
    _decide(client, staff, world["mou_c"], "terminate", "ไม่ต่อ")
    figures = client.get(SUMMARY, headers=staff).json()["renewals"]
    assert (figures["due"], figures["renewed"], figures["renewalRate"]) == (3, 1, 0.3333)
    assert figures["agreements"] == 3  # the new renewal draft is not counted until approved


def test_renewal_figures_follow_the_stakeholder_filter(client, world, staff):
    figures = client.get(SUMMARY, params={"stakeholder_type": "company"}, headers=staff).json()["renewals"]
    assert (figures["agreements"], figures["activated"], figures["due"]) == (1, 0, 0)
    assert figures["renewalRate"] is None and figures["activationRate"] == 0.0


def test_empty_database_has_no_rates(client, staff):
    figures = client.get(SUMMARY, headers=staff).json()["renewals"]
    assert figures["renewalRate"] is None and figures["activationRate"] is None
