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


# --- writing outcomes ---------------------------------------------------------

@pytest.fixture
def write_world(client, db_session, cognito):
    headers = {role: bearer(token_for(client, role)) for role in ROLES}
    coordinator = _user(db_session, "coordinator")
    own = models.Activity(name="Mine", is_published=True, owner_user_id=coordinator.id)
    other = models.Activity(name="Someone else's", is_published=True)
    db_session.add_all([own, other])
    db_session.commit()
    type_id = db_session.query(models.OutcomeType).filter_by(code="participants").one().id
    return headers, own, other, type_id


def _audit_actions(db_session, outcome_id):
    return [log.action for log in db_session.query(models.AuditLog)
            .filter_by(entity="outcomes", entity_id=outcome_id).order_by(models.AuditLog.id)]


@pytest.mark.parametrize("role,status", [
    (None, 401), ("public", 403), ("student", 403), ("coordinator", 201), ("staff", 201), ("admin", 201),
])
def test_create_outcome_by_role(client, db_session, write_world, role, status):
    headers, own, _, type_id = write_world
    body = {"title": "35 participants", "outcome_type_id": type_id, "value": 35, "activity_id": own.id}
    response = client.post("/api/v1/outcomes/", json=body, headers=headers[role] if role else None)
    assert response.status_code == status, response.text
    if status == 201:
        created = response.json()
        assert created["is_published"] is False and created["value"] == 35
        assert _audit_actions(db_session, created["id"]) == ["create"]


def test_create_outcome_validation_and_coordinator_scope(client, db_session, write_world):
    headers, own, other, type_id = write_world
    coord, staff = headers["coordinator"], headers["staff"]
    base = {"title": "Result", "outcome_type_id": type_id}

    assert client.post("/api/v1/outcomes/", json=base, headers=staff).status_code == 422  # no context
    assert client.post("/api/v1/outcomes/", json={**base, "activity_id": 99999}, headers=staff).status_code == 422
    inactive = db_session.query(models.OutcomeType).filter_by(code="funding").one()
    inactive.is_active = False
    db_session.commit()
    assert client.post("/api/v1/outcomes/", json={**base, "outcome_type_id": inactive.id,
                                                  "activity_id": own.id}, headers=staff).status_code == 422
    assert client.post("/api/v1/outcomes/", json={**base, "activity_id": own.id,
                                                  "evidence_url": "javascript:alert(1)"},
                       headers=staff).status_code == 422

    assert client.post("/api/v1/outcomes/", json={**base, "activity_id": other.id}, headers=coord).status_code == 403
    # Owning one linked context does not open another one.
    partner = models.Partner(name="Not mine")
    db_session.add(partner)
    db_session.commit()
    assert client.post("/api/v1/outcomes/", json={**base, "activity_id": own.id, "partner_id": partner.id},
                       headers=coord).status_code == 403
    assert client.post("/api/v1/outcomes/", json={**base, "activity_id": own.id, "is_published": True},
                       headers=coord).status_code == 403
    published = client.post("/api/v1/outcomes/", json={**base, "activity_id": other.id, "is_published": True},
                            headers=staff)
    assert published.status_code == 201 and published.json()["is_published"] is True


def test_update_outcome_scope_publish_and_audit(client, db_session, write_world):
    headers, own, other, type_id = write_world
    coord = headers["coordinator"]
    mine = _outcome(db_session, "Mine", published=False, activity_id=own.id)
    theirs = _outcome(db_session, "Theirs", published=False, activity_id=other.id)

    edited = client.patch(f"/api/v1/outcomes/{mine.id}", json={"title": "Mine, edited", "value": 40}, headers=coord)
    assert edited.status_code == 200, edited.text
    assert edited.json()["title"] == "Mine, edited"
    assert client.patch(f"/api/v1/outcomes/{mine.id}", json={"activity_id": other.id},
                        headers=coord).status_code == 403
    assert client.patch(f"/api/v1/outcomes/{mine.id}", json={"is_published": True},
                        headers=coord).status_code == 403
    assert client.patch(f"/api/v1/outcomes/{mine.id}", json={"activity_id": None},
                        headers=headers["staff"]).status_code == 422
    assert client.patch(f"/api/v1/outcomes/{theirs.id}", json={"title": "x"}, headers=coord).status_code == 404
    for role in ("public", "student"):
        assert client.patch(f"/api/v1/outcomes/{mine.id}", json={"title": "x"},
                            headers=headers[role]).status_code == 403

    for role in ("staff", "admin"):
        response = client.patch(f"/api/v1/outcomes/{theirs.id}", json={"is_published": True}, headers=headers[role])
        assert response.status_code == 200 and response.json()["is_published"] is True
    assert _audit_actions(db_session, mine.id) == ["update"]
    log = db_session.query(models.AuditLog).filter_by(entity="outcomes", entity_id=mine.id).one()
    assert log.before["title"] == "Mine" and log.after["title"] == "Mine, edited"


@pytest.mark.parametrize("role,status", [
    (None, 401), ("public", 403), ("student", 403), ("coordinator", 403), ("staff", 204), ("admin", 204),
])
def test_delete_outcome_by_role(client, db_session, write_world, role, status):
    headers, own, _, _ = write_world
    row = _outcome(db_session, "To delete", activity_id=own.id)
    response = client.delete(f"/api/v1/outcomes/{row.id}", headers=headers[role] if role else None)
    assert response.status_code == status, response.text
    if status == 204:
        db_session.refresh(row)
        assert row.is_deleted is True
        assert _audit_actions(db_session, row.id) == ["delete"]
        assert client.get(f"/api/v1/outcomes/{row.id}", headers=headers["staff"]).status_code == 404
        assert client.delete(f"/api/v1/outcomes/{row.id}", headers=headers[role]).status_code == 404


# --- abuse cases: inputs that would overflow Postgres must be 422, not 500 ----

def test_outcome_rejects_out_of_range_numbers(client, write_world):
    headers, own, _, type_id = write_world
    staff = headers["staff"]
    base = {"title": "Big", "outcome_type_id": type_id, "activity_id": own.id}
    # Numeric(14, 2) holds at most 12 digits before the point.
    assert client.post("/api/v1/outcomes/", json={**base, "value": 1e12}, headers=staff).status_code == 422
    assert client.post("/api/v1/outcomes/", json={**base, "value": -1e12}, headers=staff).status_code == 422
    raw = '{"title": "Inf", "outcome_type_id": %d, "activity_id": %d, "value": Infinity}' % (type_id, own.id)
    response = client.post("/api/v1/outcomes/", content=raw,
                           headers={**staff, "Content-Type": "application/json"})
    assert response.status_code == 422
    assert client.get("/api/v1/outcomes/?page=1000000000000000000", headers=staff).status_code == 422


# --- gaps found by mutation testing in review ---------------------------------

def test_coordinator_cannot_edit_published_outcome_on_someone_elses_record(client, db_session, write_world):
    headers, _, other, _ = write_world
    theirs = _outcome(db_session, "Public, not mine", activity_id=other.id)  # published, public context
    coord = headers["coordinator"]
    assert client.get(f"/api/v1/outcomes/{theirs.id}", headers=coord).status_code == 200
    assert client.patch(f"/api/v1/outcomes/{theirs.id}", json={"title": "x"}, headers=coord).status_code == 404


def test_public_visibility_follows_each_context_kind(client, db_session, cognito):
    hidden_exchange = models.ExchangeStudent(name="Hidden", is_published=False)
    hidden_partner = models.Partner(name="Unverified partner")
    hidden_document = models.Document(name="Draft MoU")
    db_session.add_all([hidden_exchange, hidden_partner, hidden_document])
    db_session.commit()
    for field, row in (("exchange_id", hidden_exchange), ("partner_id", hidden_partner),
                       ("document_id", hidden_document)):
        outcome = _outcome(db_session, f"On hidden {field}", **{field: row.id})
        assert client.get(f"/api/v1/outcomes/{outcome.id}").status_code == 404, field
    hidden_exchange.is_published = True
    db_session.commit()
    assert _titles(client.get("/api/v1/outcomes/")) == {"On hidden exchange_id"}


def test_outcome_cannot_link_to_a_deleted_record(client, db_session, write_world):
    headers, own, _, type_id = write_world
    own.is_deleted = True
    db_session.commit()
    response = client.post("/api/v1/outcomes/", headers=headers["staff"],
                           json={"title": "On deleted", "outcome_type_id": type_id, "activity_id": own.id})
    assert response.status_code == 422


def test_outcome_with_deactivated_type_stays_editable(client, db_session, write_world):
    headers, own, _, type_id = write_world
    row = _outcome(db_session, "Old type", activity_id=own.id)
    db_session.get(models.OutcomeType, type_id).is_active = False
    db_session.commit()
    # The edit form resends the current type; only switching to an inactive type is refused.
    response = client.patch(f"/api/v1/outcomes/{row.id}", headers=headers["staff"],
                            json={"outcome_type_id": type_id, "title": "Old type, edited"})
    assert response.status_code == 200, response.text
    funding = db_session.query(models.OutcomeType).filter_by(code="funding").one()
    funding.is_active = False
    db_session.commit()
    assert client.patch(f"/api/v1/outcomes/{row.id}", headers=headers["staff"],
                        json={"outcome_type_id": funding.id}).status_code == 422
