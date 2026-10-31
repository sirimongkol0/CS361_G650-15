"""V4-2 outcomes API: outcome-type lookups, role-scoped reads and audited writes."""
import pytest

import models
from tests.test_auth import bearer, cognito, token_for  # noqa: F401

ROLES = ("public", "student", "coordinator", "staff", "admin")


# --- outcome-type lookups ----------------------------------------------------

def test_active_outcome_types_are_listed_without_auth(client, db_session):
    funding = db_session.query(models.OutcomeType).filter_by(code="funding").one()
    funding.is_active = False
    db_session.commit()

    response = client.get("/api/v1/outcomes/types")
    assert response.status_code == 200
    codes = [row["code"] for row in response.json()]
    assert "participants" in codes and "funding" not in codes
    assert response.json()[0]["unit"] == "คน"


@pytest.mark.parametrize("role", [r for r in ROLES if r != "admin"])
def test_outcome_lookup_admin_endpoints_reject_non_admins(client, cognito, role):
    headers = bearer(token_for(client, role))
    body = {"code": "award", "name_th": "รางวัล", "unit": "รางวัล"}
    assert client.get("/api/v1/outcomes/lookups", headers=headers).status_code == 403
    assert client.post("/api/v1/outcomes/lookups", json=body, headers=headers).status_code == 403
    assert client.patch("/api/v1/outcomes/lookups/1", json={"is_active": False},
                        headers=headers).status_code == 403
    assert client.get("/api/v1/outcomes/lookups").status_code == 401


def test_admin_adds_and_edits_outcome_type_with_audit(client, db_session, cognito):
    headers = bearer(token_for(client, "admin"))
    created = client.post("/api/v1/outcomes/lookups", headers=headers,
                          json={"code": "award", "name_th": "รางวัล", "unit": "รางวัล", "sort_order": 9})
    assert created.status_code == 201, created.text
    row = created.json()
    assert (row["code"], row["unit"], row["is_active"]) == ("award", "รางวัล", True)
    assert "award" in [t["code"] for t in client.get("/api/v1/outcomes/types").json()]

    duplicate = client.post("/api/v1/outcomes/lookups", headers=headers,
                            json={"code": "award", "name_th": "ซ้ำ"})
    assert duplicate.status_code == 409

    updated = client.patch(f"/api/v1/outcomes/lookups/{row['id']}", headers=headers,
                           json={"name_th": "รางวัลที่ได้รับ", "is_active": False})
    assert updated.status_code == 200, updated.text
    assert updated.json()["name_th"] == "รางวัลที่ได้รับ"
    assert "award" not in [t["code"] for t in client.get("/api/v1/outcomes/types").json()]
    assert "award" in [t["code"] for t in client.get("/api/v1/outcomes/lookups", headers=headers).json()]

    actions = [log.action for log in db_session.query(models.AuditLog)
               .filter_by(entity="outcome_types", entity_id=row["id"]).order_by(models.AuditLog.id)]
    assert actions == ["create", "update"]
    assert client.patch("/api/v1/outcomes/lookups/99999", headers=headers,
                        json={"is_active": False}).status_code == 404


# --- reading outcomes ---------------------------------------------------------

def _user(db_session, role):
    return db_session.query(models.User).filter_by(email=f"{role}@example.test").one()


def _outcome(db_session, title, published=True, **context):
    type_id = db_session.query(models.OutcomeType).filter_by(code="participants").one().id
    row = models.Outcome(title=title, outcome_type_id=type_id, is_published=published, **context)
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture
def read_world(client, db_session, cognito):
    """Signed-in users plus outcomes on public, hidden and coordinator-owned activities."""
    headers = {role: bearer(token_for(client, role)) for role in ROLES}
    coordinator = _user(db_session, "coordinator")
    public_act = models.Activity(name="Open day", is_published=True)
    hidden_act = models.Activity(name="Draft", is_published=False)
    own_act = models.Activity(name="Mine", is_published=False, owner_user_id=coordinator.id)
    db_session.add_all([public_act, hidden_act, own_act])
    db_session.commit()
    rows = {
        "public": _outcome(db_session, "Published on public", activity_id=public_act.id),
        "unpublished": _outcome(db_session, "Unpublished", published=False, activity_id=public_act.id),
        "hidden_context": _outcome(db_session, "Published on hidden", activity_id=hidden_act.id),
        "own": _outcome(db_session, "Coordinator's", published=False, activity_id=own_act.id),
        "deleted": _outcome(db_session, "Deleted", activity_id=public_act.id),
    }
    rows["deleted"].is_deleted = True
    db_session.commit()
    return headers, rows, public_act


def _titles(response):
    assert response.status_code == 200, response.text
    return {row["title"] for row in response.json()["items"]}


@pytest.mark.parametrize("role,expected", [
    (None, {"public"}),
    ("public", {"public"}),
    ("student", {"public"}),
    ("coordinator", {"public", "own"}),
    ("staff", {"public", "unpublished", "hidden_context", "own"}),
    ("admin", {"public", "unpublished", "hidden_context", "own"}),
])
def test_outcome_list_is_scoped_by_role(client, read_world, role, expected):
    headers, rows, _ = read_world
    response = client.get("/api/v1/outcomes/", headers=headers[role] if role else None)
    assert _titles(response) == {rows[key].title for key in expected}
    for key, row in rows.items():
        status = client.get(f"/api/v1/outcomes/{row.id}", headers=headers[role] if role else None).status_code
        assert status == (200 if key in expected else 404), (key, status)


def test_outcome_list_filters_and_paginates(client, db_session, read_world):
    headers, rows, public_act = read_world
    staff = headers["staff"]
    from datetime import date
    rows["public"].occurred_on = date(2026, 3, 1)
    rows["unpublished"].occurred_on = date(2025, 3, 1)
    db_session.commit()

    assert _titles(client.get(f"/api/v1/outcomes/?activity_id={public_act.id}", headers=staff)) == {
        rows["public"].title, rows["unpublished"].title}
    assert _titles(client.get("/api/v1/outcomes/?date_from=2026-01-01", headers=staff)) == {rows["public"].title}
    assert client.get("/api/v1/outcomes/?date_from=2026-02-01&date_to=2026-01-01",
                      headers=staff).status_code == 422
    other_type = db_session.query(models.OutcomeType).filter_by(code="funding").one().id
    assert _titles(client.get(f"/api/v1/outcomes/?outcome_type_id={other_type}", headers=staff)) == set()

    page = client.get("/api/v1/outcomes/?page=2&page_size=3", headers=staff).json()
    assert (page["total"], page["page"], page["page_size"], len(page["items"])) == (4, 2, 3, 1)
    assert client.get("/api/v1/outcomes/?page_size=101", headers=staff).status_code == 422
    item = client.get(f"/api/v1/outcomes/{rows['public'].id}").json()
    assert item["outcome_type"]["code"] == "participants" and item["unit"] == "คน"
    assert "owner_user_id" not in item and "external_id" not in item
