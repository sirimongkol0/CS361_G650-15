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
    