from datetime import date, datetime, timezone

import pytest
import models


@pytest.mark.parametrize("path", ["users/", "users/1", "feedback/", "feedback/1", "exchange/", "exchange/1"])
def test_internal_routes_are_not_public(client, path):
    assert client.get(f"/api/v1/{path}").status_code == 404
    assert f"/api/v1/{path}" not in client.get("/openapi.json").json()["paths"]


def test_openapi_exposes_repository_reads_partner_crud_and_auth(client):
    paths = client.get("/openapi.json").json()["paths"]
    auth_paths = {path: set(methods) for path, methods in paths.items() if path.startswith("/api/v1/auth/")}
    assert auth_paths == {"/api/v1/auth/login": {"post"}, "/api/v1/auth/logout": {"post"},
                          "/api/v1/auth/me": {"get"}}
    # Staff/admin-only reads (require_role); everything else stays public repository reads.
    protected = {path: set(methods) for path, methods in paths.items() if path.startswith("/api/v1/audit-logs")}
    assert protected == {"/api/v1/audit-logs/": {"get"}}
    repository = {
        path: set(methods)
        for path, methods in paths.items()
        if path not in auth_paths and path not in protected
    }
    assert repository == {
        "/api/v1/health": {"get"},
        "/api/v1/partners/": {"get", "post"},
        "/api/v1/partners/{partner_id}": {"get", "put", "delete"},
        "/api/v1/partners/{partner_id}/logo": {"get"},
        "/api/v1/documents/": {"get"},
        "/api/v1/documents/{document_id}": {"get"},
        "/api/v1/documents/{document_id}/download": {"get"},
        "/api/v1/activities/": {"get"},
        "/api/v1/activities/{activity_id}": {"get"},
    }


@pytest.mark.parametrize(("method", "path", "expected_status"), [
    ("post", "partners/", 401),
    ("put", "partners/1", 401),
    ("delete", "partners/1", 401),
    ("post", "documents/", 405),
    ("post", "activities/", 405),
])
def test_repository_writes_require_auth_or_are_not_registered(
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
            file_availability="metadata_only", is_published=True,
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
