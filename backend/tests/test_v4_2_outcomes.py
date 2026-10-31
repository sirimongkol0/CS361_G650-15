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
