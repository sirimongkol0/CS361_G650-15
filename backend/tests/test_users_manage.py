"""Student picker, admin is_active toggle and relinking an exchange record (issue #104)."""
import models
from tests.test_auth import assert_error, bearer, cognito, token_for  # noqa: F401


def _user(db_session, email):
    return db_session.query(models.User).filter_by(email=email).one()


def test_student_picker_lists_active_students_for_managers(client, db_session, cognito):
    token_for(client, "student")
    assert client.get("/api/v1/users/students", headers=bearer(token_for(client, "student"))).status_code == 403
    body = client.get("/api/v1/users/students", headers=bearer(token_for(client, "coordinator"))).json()
    assert body == [{"id": _user(db_session, "student@example.test").id, "email": "student@example.test"}]


def test_admin_toggles_is_active_and_it_is_audited(client, db_session, cognito):
    student_token = token_for(client, "student")
    admin = bearer(token_for(client, "admin"))
    student_id = _user(db_session, "student@example.test").id

    response = client.patch(f"/api/v1/users/{student_id}", headers=admin, json={"isActive": False})
    assert response.status_code == 200, response.text
    assert response.json()["isActive"] is False
    assert_error(client.get("/api/v1/auth/me", headers=bearer(student_token)), 403, "Account is disabled")
    assert db_session.query(models.AuditLog).filter_by(entity="users", entity_id=student_id).count() == 1

    assert client.patch(f"/api/v1/users/{student_id}", headers=admin, json={"isActive": True}).json()["isActive"]


def test_only_admin_toggles_and_not_their_own_account(client, db_session, cognito):
    staff = bearer(token_for(client, "staff"))
    admin = bearer(token_for(client, "admin"))
    admin_id = _user(db_session, "admin@example.test").id
    assert client.patch(f"/api/v1/users/{admin_id}", headers=staff, json={"isActive": False}).status_code == 403
    assert client.patch(f"/api/v1/users/{admin_id}", headers=admin, json={"isActive": False}).status_code == 422


def test_exchange_record_can_be_relinked_to_a_student(client, db_session, cognito):
    token_for(client, "student")
    staff = bearer(token_for(client, "staff"))
    student_id = _user(db_session, "student@example.test").id
    staff_id = _user(db_session, "staff@example.test").id
    created = client.post("/api/v1/exchange/", headers=staff, json={"name": "Exchange"}).json()

    linked = client.patch(f"/api/v1/exchange/{created['id']}", headers=staff, json={"user_id": student_id})
    assert linked.status_code == 200, linked.text
    rejected = client.patch(f"/api/v1/exchange/{created['id']}", headers=staff, json={"user_id": staff_id})
    assert rejected.status_code == 422
