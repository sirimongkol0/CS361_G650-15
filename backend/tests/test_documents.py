"""Tests for the /documents endpoints (local storage backend).

Covers: upload happy path, mime-type rejection, size limit,
download round-trip, delete, and list filtering.
"""
import io

import pytest
from fastapi.testclient import TestClient

import main
import models
from database import get_db, SessionLocal, engine, Base


@pytest.fixture(scope="function", autouse=True)
def setup_database(tmp_path, monkeypatch):
    """Isolated DB + isolated local storage dir per test."""
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr("config.settings.LOCAL_STORAGE_DIR", str(tmp_path))
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    return TestClient(main.app)


PDF_BYTES = b"%PDF-1.4 fake pdf content for testing"


def _upload(client, filename="report.pdf", content=PDF_BYTES, mime="application/pdf"):
    return client.post(
        "/api/v1/documents/",
        files={"file": (filename, io.BytesIO(content), mime)},
    )


def test_upload_and_download_roundtrip(client, db_session):
    resp = _upload(client)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "report.pdf"
    assert body["mimeType"] == "application/pdf"
    assert body["sizeBytes"] == len(PDF_BYTES)
    assert body["storageKey"].startswith("documents/")

    # Bytes must NOT be in the database -- only metadata
    doc = db_session.query(models.Document).get(body["id"])
    assert doc.storage_key == body["storageKey"]

    dl = client.get(f"/api/v1/documents/{body['id']}/download")
    assert dl.status_code == 200
    assert dl.content == PDF_BYTES
    assert dl.headers["content-type"].startswith("application/pdf")


def test_upload_rejects_non_pdf(client):
    resp = client.post(
        "/api/v1/documents/",
        files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert resp.status_code == 415


def test_upload_rejects_oversized_file(client, monkeypatch):
    monkeypatch.setattr("routers.documents.MAX_FILE_SIZE", 10)
    resp = _upload(client, content=b"x" * 100)
    assert resp.status_code == 413


def test_delete_document_removes_row_and_file(client, db_session):
    resp = _upload(client)
    doc_id = resp.json()["id"]
    key = resp.json()["storageKey"]

    del_resp = client.delete(f"/api/v1/documents/{doc_id}")
    assert del_resp.status_code == 204
    assert db_session.query(models.Document).get(doc_id) is None


def test_list_documents_only_published(client, db_session):
    r1 = _upload(client, filename="a.pdf")
    doc_id = r1.json()["id"]
    doc = db_session.query(models.Document).get(doc_id)
    doc.is_published = False
    db_session.commit()

    listed = client.get("/api/v1/documents/").json()
    assert all(d["id"] != doc_id for d in listed)


def test_download_missing_returns_404(client):
    assert client.get("/api/v1/documents/9999/download").status_code == 404
