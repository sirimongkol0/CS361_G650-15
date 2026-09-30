from datetime import date, datetime, timezone

import models
import storage


def agreement(name, **values):
    defaults = dict(is_published=True, document_kind="agreement", doc_type="mou",
                    file_availability="metadata_only", status="active",
                    effective_date=date(2026, 1, 1), expiry_date=date(2026, 12, 31),
                    sources=[models.Source(source_url=f"https://example.test/{name}",
                             source_type="official_document", verification_status="verified",
                             source_checked_at=datetime.now(timezone.utc))])
    defaults.update(values)
    return models.Document(name=name, **defaults)


def test_detail_list_refresh_and_combined_filters(client, db_session):
    first = agreement("Alpha", responsible="Coordinator")
    second = agreement("Beta", doc_type="moa", status="expired",
                       effective_date=date(2025, 1, 1), expiry_date=date(2025, 12, 31))
    unknown = agreement("Unknown", effective_date=None, expiry_date=None)
    db_session.add_all([first, second, unknown])
    db_session.commit()
    rows = client.get("/api/v1/documents/").json()
    for row in rows:
        assert client.get(f"/api/v1/documents/{row['id']}").json() == row
    filters = dict(search=" Alpha ", doc_type="mou", status="active",
                   date_from="2026-12-31", date_to="2026-12-31")
    assert [r["id"] for r in client.get("/api/v1/documents/", params=filters).json()] == [first.id]
    filters["status"] = "expired"
    assert client.get("/api/v1/documents/", params=filters).json() == []
    assert len(client.get("/api/v1/documents/").json()) == 3
    assert client.get("/api/v1/documents/?date_from=2027-01-01&date_to=2026-01-01").status_code == 422
    assert client.get("/api/v1/documents/?date_from=invalid").status_code == 422
    first.responsible = "Updated coordinator"
    db_session.commit()
    assert client.get(f"/api/v1/documents/{first.id}").json()["responsible"] == "Updated coordinator"


def test_download_matches_detail_unicode_filename_and_missing_file(client, db_session):
    data = b"%PDF-1.4 agreement bytes"
    storage.put_file("agreements/first.pdf", data)
    first = agreement("Download", storage_key="agreements/first.pdf", file_name="ข้อตกลง.pdf",
                      file_availability="available", mime_type="application/pdf", size_bytes=len(data))
    draft = agreement("Draft", is_published=False)
    db_session.add_all([first, draft])
    db_session.commit()
    detail = client.get(f"/api/v1/documents/{first.id}").json()
    download = client.get(f"/api/v1/documents/{first.id}/download")
    assert download.status_code == 200 and download.content == data
    assert len(download.content) == detail["sizeBytes"]
    assert "filename*=UTF-8''" in download.headers["content-disposition"]
    storage.delete_file(first.storage_key)
    assert client.get(f"/api/v1/documents/{first.id}/download").status_code == 404
    assert client.get(f"/api/v1/documents/{first.id}").status_code == 200
    assert client.get(f"/api/v1/documents/{draft.id}").status_code == 404
    assert client.get("/api/v1/documents/999999").status_code == 404


def test_related_partner_matches_public_detail_and_hides_draft(client, db_session):
    partner = models.Partner(name="Public partner", type="government", country_code="TH",
                             description="Public description", website_url="https://example.test",
                             is_published=True, sources=[models.Source(
                                 source_url="https://example.test/partner", source_type="official_page",
                                 verification_status="verified", source_checked_at=datetime.now(timezone.utc))])
    doc = agreement("Related", partner=partner)
    db_session.add(doc)
    db_session.commit()
    row = client.get(f"/api/v1/documents/{doc.id}").json()
    assert row["partner"] == {"id": partner.id, "name": partner.name}
    assert client.get(f"/api/v1/partners/{row['partnerId']}").status_code == 200
    partner.is_published = False
    db_session.commit()
    row = client.get(f"/api/v1/documents/{doc.id}").json()
    assert row["partner"] is None and row["partnerId"] is None
