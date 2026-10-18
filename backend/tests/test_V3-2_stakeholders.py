import pytest
import models
from tests.test_auth import bearer, cognito, login, token_for  # noqa: F401

BASE_URL = "/api/v1/partners"


def test_unauthenticated_create_fails(client):
    res = client.post(f"{BASE_URL}/", json={"name": "Test Partner"})
    assert res.status_code == 401


@pytest.mark.parametrize("role", ["public", "student"])
def test_forbidden_roles_cannot_create(client, cognito, role):
    headers = bearer(token_for(client, role))
    res = client.post(f"{BASE_URL}/", json={"name": f"Partner by {role}"}, headers=headers)
    assert res.status_code == 403


@pytest.mark.parametrize("role", ["public", "student"])
@pytest.mark.parametrize("method", ["put", "delete"])
def test_public_and_student_cannot_update_or_delete(client, cognito, db_session, role, method):
    partner = models.Partner(name=f"Protected from {role}")
    db_session.add(partner)
    db_session.commit()
    headers = bearer(token_for(client, role))

    if method == "put":
        response = client.put(
            f"{BASE_URL}/{partner.id}",
            json={"name": "Unauthorized update"},
            headers=headers,
        )
    else:
        response = client.delete(f"{BASE_URL}/{partner.id}", headers=headers)

    assert response.status_code == 403
    db_session.refresh(partner)
    assert partner.name == f"Protected from {role}"
    assert partner.is_deleted is False


def test_coordinator_create_and_update_own(client, cognito):
    headers = bearer(token_for(client, "coordinator"))

    # 1. Create
    res = client.post(f"{BASE_URL}/", json={"name": "Coord Partner", "type": "alumni"}, headers=headers)
    assert res.status_code == 201
    partner_id = res.json()["id"]

    # 2. Update Own
    res_update = client.put(
        f"{BASE_URL}/{partner_id}", json={"description": "Updated by owner"}, headers=headers
    )
    assert res_update.status_code == 200
    assert res_update.json()["description"] == "Updated by owner"

    # 3. Coordinator cannot DELETE
    res_delete = client.delete(f"{BASE_URL}/{partner_id}", headers=headers)
    assert res_delete.status_code == 403


def test_coordinator_cannot_publish_partner_on_create_or_update(client, cognito):
    headers = bearer(token_for(client, "coordinator"))
    created_as_published = client.post(
        f"{BASE_URL}/", json={"name": "Coordinator published create", "isPublished": True},
        headers=headers,
    )
    assert created_as_published.status_code == 403

    created_as_draft = client.post(
        f"{BASE_URL}/", json={"name": "Coordinator draft"}, headers=headers
    )
    assert created_as_draft.status_code == 201
    partner_id = created_as_draft.json()["id"]
    publish_update = client.put(
        f"{BASE_URL}/{partner_id}", json={"is_published": True}, headers=headers
    )
    assert publish_update.status_code == 403

    admin_headers = bearer(token_for(client, "admin"))
    published_by_admin = client.put(
        f"{BASE_URL}/{partner_id}", json={"is_published": True}, headers=admin_headers
    )
    assert published_by_admin.status_code == 200
    unpublish_update = client.put(
        f"{BASE_URL}/{partner_id}", json={"isPublished": False}, headers=headers
    )
    assert unpublish_update.status_code == 403
    assert client.get(f"{BASE_URL}/{partner_id}", headers=admin_headers).json()["isPublished"] is True


def test_coordinator_cannot_update_another_coordinators_partner(client, cognito, db_session):
    token_for(client, "coordinator")
    owner = db_session.query(models.User).filter_by(email="coordinator@example.test").one()
    cognito.add("second-coordinator@example.test", ["coordinator"])
    second_login = login(client, "second-coordinator@example.test")
    assert second_login.status_code == 200
    other_headers = bearer(second_login.json()["access_token"])

    partner = models.Partner(name="Owned by coordinator", owner_user_id=owner.id)
    db_session.add(partner)
    db_session.commit()

    response = client.put(
        f"{BASE_URL}/{partner.id}",
        json={"description": "Unauthorized change"},
        headers=other_headers,
    )

    assert response.status_code == 403
    db_session.refresh(partner)
    assert partner.description is None


def test_staff_admin_full_access(client, cognito):
    staff_headers = bearer(token_for(client, "staff"))

    # 1. Staff Create
    res = client.post(f"{BASE_URL}/", json={"name": "Staff Partner"}, headers=staff_headers)
    assert res.status_code == 201
    partner_id = res.json()["id"]

    # 2. Staff Delete (Soft Delete)
    res_del = client.delete(f"{BASE_URL}/{partner_id}", headers=staff_headers)
    assert res_del.status_code == 204

    # 3. Get Deleted -> 404
    res_get = client.get(f"{BASE_URL}/{partner_id}", headers=staff_headers)
    assert res_get.status_code == 404


def test_admin_can_create_update_and_delete_partner(client, cognito, db_session):
    headers = bearer(token_for(client, "admin"))

    created = client.post(f"{BASE_URL}/", json={"name": "Admin Partner"}, headers=headers)
    assert created.status_code == 201
    partner_id = created.json()["id"]

    updated = client.put(
        f"{BASE_URL}/{partner_id}", json={"description": "Updated by admin"}, headers=headers
    )
    assert updated.status_code == 200
    assert updated.json()["description"] == "Updated by admin"

    audit_rows = db_session.query(models.AuditLog).filter_by(
        entity="partners", entity_id=partner_id
    ).order_by(models.AuditLog.id).all()
    assert [row.action for row in audit_rows] == ["create", "update"]
    assert audit_rows[1].before["description"] is None
    assert audit_rows[1].after["description"] == "Updated by admin"

    deleted = client.delete(f"{BASE_URL}/{partner_id}", headers=headers)
    assert deleted.status_code == 204
    assert client.get(f"{BASE_URL}/{partner_id}", headers=headers).status_code == 404
    audit_rows = db_session.query(models.AuditLog).filter_by(
        entity="partners", entity_id=partner_id
    ).order_by(models.AuditLog.id).all()
    assert [row.action for row in audit_rows] == ["create", "update", "delete"]
    assert audit_rows[2].before["is_deleted"] is False
    assert audit_rows[2].after["is_deleted"] is True


def test_draft_visibility_depends_on_role(client, cognito, db_session):
    coordinator_headers = bearer(token_for(client, "coordinator"))
    coordinator = db_session.query(models.User).filter_by(
        email="coordinator@example.test"
    ).one()
    cognito.add("other-coordinator@example.test", ["coordinator"])
    other_login = login(client, "other-coordinator@example.test")
    assert other_login.status_code == 200
    other_owner = db_session.query(models.User).filter_by(
        email="other-coordinator@example.test"
    ).one()
    own_draft = models.Partner(name="Own draft", owner_user_id=coordinator.id)
    other_draft = models.Partner(name="Other draft", owner_user_id=other_owner.id)
    unowned_draft = models.Partner(name="Unowned draft")
    db_session.add_all([own_draft, other_draft, unowned_draft])
    db_session.commit()

    public_response = client.get(f"{BASE_URL}/")
    student_response = client.get(
        f"{BASE_URL}/", headers=bearer(token_for(client, "student"))
    )
    coordinator_response = client.get(f"{BASE_URL}/", headers=coordinator_headers)
    staff_response = client.get(
        f"{BASE_URL}/", headers=bearer(token_for(client, "staff"))
    )
    admin_response = client.get(
        f"{BASE_URL}/", headers=bearer(token_for(client, "admin"))
    )

    assert public_response.status_code == student_response.status_code == 200
    assert public_response.json() == student_response.json() == []
    assert [row["name"] for row in coordinator_response.json()] == ["Own draft"]
    assert {row["name"] for row in staff_response.json()} == {
        "Own draft", "Other draft", "Unowned draft"
    }
    assert {row["name"] for row in admin_response.json()} == {
        "Own draft", "Other draft", "Unowned draft"
    }


@pytest.mark.parametrize("organization_id", [999999, -1, 0])
def test_create_rejects_invalid_organization_id(client, cognito, organization_id):
    headers = bearer(token_for(client, "admin"))
    response = client.post(
        f"{BASE_URL}/",
        json={"name": f"Invalid organization {organization_id}", "organizationId": organization_id},
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Referenced organization does not exist"}


@pytest.mark.parametrize("organization_id", [999999, -1, 0])
def test_update_rejects_invalid_organization_id(client, cognito, db_session, organization_id):
    headers = bearer(token_for(client, "admin"))
    partner = models.Partner(name="Partner before invalid organization update")
    db_session.add(partner)
    db_session.commit()

    response = client.put(
        f"{BASE_URL}/{partner.id}",
        json={"organizationId": organization_id},
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Referenced organization does not exist"}
    db_session.refresh(partner)
    assert partner.organization_id is None


def test_create_rejects_deleted_organization(client, cognito, db_session):
    headers = bearer(token_for(client, "admin"))
    organization = models.Partner(name="Deleted organization", is_deleted=True)
    db_session.add(organization)
    db_session.commit()

    response = client.post(
        f"{BASE_URL}/",
        json={"name": "Child partner", "organization_id": organization.id},
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Referenced organization does not exist"}


def test_update_rejects_deleted_organization(client, cognito, db_session):
    headers = bearer(token_for(client, "admin"))
    organization = models.Partner(name="Deleted organization for update", is_deleted=True)
    partner = models.Partner(name="Partner with invalid organization")
    db_session.add_all([organization, partner])
    db_session.commit()

    response = client.put(
        f"{BASE_URL}/{partner.id}",
        json={"organization_id": organization.id},
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Referenced organization does not exist"}
    db_session.refresh(partner)
    assert partner.organization_id is None


def test_validation_errors(client, cognito):
    headers = bearer(token_for(client, "admin"))

    # Invalid Email
    res = client.post(
        f"{BASE_URL}/",
        json={"name": "Invalid Email", "contactEmail": "not-an-email"},
        headers=headers,
    )
    assert res.status_code == 422

    # Empty Name
    res_empty = client.post(f"{BASE_URL}/", json={"name": "   "}, headers=headers)
    assert res_empty.status_code == 422
    

# --- V3-7: staff attach a verified source so web-created partners can be public ----

def _public_partner_body(**extra):
    return {"name": "Web Partner University", "type": "university", "description": "Created on the web",
            "website_url": "https://partner.example.test", "country": "Japan", "country_code": "JP", **extra}


def test_staff_partner_with_source_and_publish_appears_publicly(client, db_session, cognito):
    staff = bearer(token_for(client, "staff"))
    created = client.post("/api/v1/partners/", headers=staff, json=_public_partner_body(
        is_published=True, source_url="https://partner.example.test/mou"))
    assert created.status_code == 201, created.text
    public = client.get("/api/v1/partners/").json()
    assert [p["name"] for p in public] == ["Web Partner University"]
    log = db_session.query(models.AuditLog).filter_by(entity="partners", entity_id=created.json()["id"]).one()
    assert log.after["source_url"] == "https://partner.example.test/mou"


def test_partner_source_can_be_added_later_by_update(client, db_session, cognito):
    staff = bearer(token_for(client, "staff"))
    partner_id = client.post("/api/v1/partners/", headers=staff, json=_public_partner_body(is_published=True)).json()["id"]
    assert client.get("/api/v1/partners/").json() == []  # no verified source yet
    updated = client.put(f"/api/v1/partners/{partner_id}", headers=staff, json={"source_url": "https://partner.example.test/later"})
    assert updated.status_code == 200, updated.text
    assert [p["id"] for p in client.get("/api/v1/partners/").json()] == [partner_id]


def test_coordinator_cannot_verify_partner_sources(client, db_session, cognito):
    coordinator = bearer(token_for(client, "coordinator"))
    response = client.post("/api/v1/partners/", headers=coordinator,
                           json=_public_partner_body(source_url="https://partner.example.test/x"))
    assert response.status_code == 403
    assert db_session.query(models.Partner).count() == 0
