from datetime import date, datetime, timezone

import pytest
import models


@pytest.mark.parametrize(("path", "status"), [
    ("users/", 401), ("users/1", 401), ("feedback/manage", 401), ("feedback/1", 404), ("exchange/1", 404),
])
def test_internal_routes_are_not_public(client, path, status):
    assert client.get(f"/api/v1/{path}").status_code == status


DOCUMENT_WRITE_PATHS = {
    "/api/v1/documents/": {"get", "post"},
    "/api/v1/documents/manage": {"get"},
    "/api/v1/documents/{document_id}": {"get", "patch", "delete"},
    "/api/v1/documents/{document_id}/transition": {"post"},
    "/api/v1/documents/{document_id}/cstu-status": {"put"},
    "/api/v1/documents/{document_id}/publish": {"post"},
    "/api/v1/documents/{document_id}/unpublish": {"post"},
    "/api/v1/documents/{document_id}/file": {"put"},
    "/api/v1/documents/{document_id}/internal-url": {"get"},
}


def test_openapi_exposes_expected_routes_and_auth(client):
    paths = client.get("/openapi.json").json()["paths"]

    auth_paths = {
        path: set(methods)
        for path, methods in paths.items()
        if path.startswith("/api/v1/auth/")
    }
    assert auth_paths == {
        "/api/v1/auth/login": {"post"},
        "/api/v1/auth/logout": {"post"},
        "/api/v1/auth/me": {"get"},
    }

    protected = {
        path: set(methods)
        for path, methods in paths.items()
        if path.startswith("/api/v1/audit-logs")
    }
    assert protected == {"/api/v1/audit-logs/": {"get"}}

    # Partner mutations remain available only to authenticated roles.
    assert set(paths["/api/v1/partners/"]) == {"get", "post"}
    assert set(paths["/api/v1/partners/{partner_id}"]) == {"get", "put", "delete"}

    # Existing public read APIs
    repository = {
        path: methods
        for path, methods in paths.items()
        if path not in auth_paths and path not in protected
        and path not in {"/api/v1/partners/", "/api/v1/partners/{partner_id}"}
        and not path.startswith("/api/v1/exchange")
        and not path.startswith("/api/v1/activities")
        and not path.startswith(("/api/v1/feedback", "/api/v1/users"))
        and path not in DOCUMENT_WRITE_PATHS
    }
    assert all(set(methods) == {"get"} for methods in repository.values())
    assert all(
        path.startswith(tuple(
            f"/api/v1/{name}"
            for name in ["health", "partners", "documents"]
        ))
        for path in repository
    )

    # V3-4 adds role-protected activity and exchange writes.
    assert set(paths["/api/v1/activities/"]) >= {"get", "post"}
    assert set(paths["/api/v1/activities/{activity_id}"]) >= {"get", "patch", "delete"}
    assert set(paths["/api/v1/exchange/"]) >= {"get", "post"}
    assert set(paths["/api/v1/exchange/{student_id}"]) >= {"get", "patch"}

    # V3-7: feedback replies and the admin user list.
    assert set(paths["/api/v1/feedback/{feedback_id}"]) == {"get", "patch"}
    assert set(paths["/api/v1/feedback/manage"]) == {"get"}
    assert set(paths["/api/v1/users/"]) == {"get"}
    assert set(paths["/api/v1/users/{user_id}"]) == {"get"}

    # V3-3 adds role-protected document writes.
    for path, methods in DOCUMENT_WRITE_PATHS.items():
        assert set(paths[path]) == methods, path


@pytest.mark.parametrize(("method", "path", "expected_status"), [
    ("post", "partners/", 401),
    ("put", "partners/1", 401),
    ("delete", "partners/1", 401),
    ("post", "documents/", 401),
    ("patch", "documents/1", 401),
    ("delete", "documents/1", 401),
])
def test_repository_write_routes_are_protected_or_absent(
    client, method, path, expected_status
):
    if method == "delete":
        response = client.delete(f"/api/v1/{path}")
    else:
        response = getattr(client, method)(f"/api/v1/{path}", json={"name": "x"})
    assert response.status_code == expected_status


@pytest.mark.parametrize("resource", ["documents", "activities"])
def test_search_matches_public_partner_but_never_hidden_partner(client, db_session, resource):
    partner = models.Partner(name="Distinctive University", type="university", country_code="TH",
        description="Public identity", website_url="https://example.test", is_published=True,
        sources=[models.Source(source_url="https://example.test/search-partner", source_type="official_page",
            source_checked_at=datetime.now(timezone.utc), verification_status="verified")])
    if resource == "documents":
        record = models.Document(name="Independent agreement", partner=partner, document_kind="agreement",
            file_availability="metadata_only", is_published=True, cstu_status="keep",
            sources=[models.Source(source_url="https://example.test/search-document", source_type="official_document",
                source_checked_at=datetime.now(timezone.utc), verification_status="verified")])
    else:
        record = models.Activity(name="Independent activity", partner=partner, is_published=True,
            date=date(2026, 10, 2), date_kind="event", date_precision="day")
    db_session.add(record)
    db_session.commit()
    path = f"/api/v1/{resource}/"
    assert [r["id"] for r in client.get(path, params={"search": " distinctive "}).json()] == [record.id]
    partner.is_published = False
    db_session.commit()
    assert client.get(path, params={"search": "distinctive"}).json() == []
    assert [r["id"] for r in client.get(path, params={"search": "Independent"}).json()] == [record.id]
    partner.is_published = True
    partner.sources[0].verification_status = "pending"
    db_session.commit()
    assert client.get(path, params={"search": "distinctive"}).json() == []


def test_activity_reversed_date_range_returns_422(client):
    assert client.get("/api/v1/activities/?date_from=2026-10-03&date_to=2026-10-02").status_code == 422
