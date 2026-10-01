"""Public V2 reads and downloads; writes must not change DB or storage."""
from datetime import datetime, timezone

import models
import storage

PDF_BYTES = b"%PDF-1.4 fake pdf content for testing"


def document(db, published=True):
    key = "documents/report.pdf"
    storage.put_file(key, PDF_BYTES)
    doc = models.Document(
        name="report.pdf", document_kind="agreement", file_availability="available",
        storage_key=key, file_name="report.pdf", mime_type="application/pdf",
        size_bytes=len(PDF_BYTES), uploaded_at=datetime.now(timezone.utc),
        is_published=published, sources=[models.Source(
            source_url="https://test.example.test/document", source_type="official_document",
            source_checked_at=datetime.now(timezone.utc), verification_status="verified",
        )],
    )
    db.add(doc)
    db.commit()
    return doc


def test_download_roundtrip(client, db_session):
    doc = document(db_session)
    body = client.get(f"/api/v1/documents/{doc.id}").json()
    assert body["fileName"] == "report.pdf"
    assert body["sizeBytes"] == len(PDF_BYTES)
    assert body["uploadedAt"] is not None
    assert "timelineSteps" not in body
    dl = client.get(f"/api/v1/documents/{doc.id}/download")
    assert dl.status_code == 200
    assert dl.content == PDF_BYTES
    assert dl.headers["content-type"].startswith("application/pdf")


def test_public_upload_is_disabled_without_creating_records(client, db_session, tmp_path):
    resp = client.post("/api/v1/documents/", files={"file": ("report.pdf", PDF_BYTES, "application/pdf")})
    assert resp.status_code == 405
    assert db_session.query(models.Document).count() == 0
    assert not list(tmp_path.rglob("*.pdf"))


def test_public_delete_is_disabled_and_preserves_row_and_file(client, db_session):
    doc = document(db_session)
    assert client.delete(f"/api/v1/documents/{doc.id}").status_code == 405
    db_session.expire_all()
    assert db_session.get(models.Document, doc.id) is not None
    assert storage.get_file(doc.storage_key) == PDF_BYTES


def test_list_documents_only_published(client, db_session):
    doc = document(db_session, published=False)
    assert all(d["id"] != doc.id for d in client.get("/api/v1/documents/").json())
    assert client.get(f"/api/v1/documents/{doc.id}/download").status_code == 404


def test_download_missing_returns_404(client):
    assert client.get("/api/v1/documents/9999/download").status_code == 404
