from datetime import date, datetime, timezone

import pytest
import models


@pytest.mark.parametrize("path", ["users/", "users/1", "feedback/", "feedback/1", "exchange/", "exchange/1"])
def test_internal_routes_are_not_public(client, path):
    assert client.get(f"/api/v1/{path}").status_code == 404
    assert f"/api/v1/{path}" not in client.get("/openapi.json").json()["paths"]


def test_openapi_exposes_only_repository_reads(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert all(set(methods) == {"get"} for methods in paths.values())
    assert all(path.startswith(tuple(f"/api/v1/{name}" for name in ["health", "partners", "documents", "activities"])) for path in paths)


def test_cors_does_not_advertise_public_writes(client):
    response = client.options("/api/v1/documents/", headers={
        "Origin": "http://localhost:3001", "Access-Control-Request-Method": "POST",
    })
    assert response.status_code == 400


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
