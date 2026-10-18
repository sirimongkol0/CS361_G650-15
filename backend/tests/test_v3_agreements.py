"""V3-3 agreements: CRUD, state machine, CSTU review, publication, file upload and internal links."""
import time
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import pytest

import models
import storage
from config import settings
from routers.documents import TRANSITIONS
from tests.test_auth import bearer, cognito, token_for  # noqa: F401

PDF = b"%PDF-1.4\n% V3-3 test file\n%%EOF\n"
ROLES = ["public", "student", "coordinator", "staff", "admin"]
STAFF_ONLY = {"public": 403, "student": 403, "coordinator": 403, "staff": 200, "admin": 200}


def user_id(db, role):
    return db.query(models.User).filter_by(email=f"{role}@example.test").one().id


def other_coordinator(db):
    other = models.User(cognito_sub="other-coordinator", email="other-coordinator@example.test",
                        role="coordinator", created_at=datetime.now(timezone.utc))
    db.add(other)
    db.commit()
    return other.id


def make_doc(db, owner_id=None, **values):
    values.setdefault("status", "draft")
    values.setdefault("file_availability", "metadata_only")
    doc = models.Document(name=values.pop("name", "MoU draft"), document_kind="agreement",
                          owner_user_id=owner_id, **values)
    db.add(doc)
    db.commit()
    return doc


def audit_actions(db, doc_id):
    rows = db.query(models.AuditLog).filter_by(entity="documents", entity_id=doc_id).order_by(models.AuditLog.id)
    return [row.action for row in rows]


def upload(client, doc_id, headers, data=PDF, content_type="application/pdf", name="mou.pdf"):
    return client.put(f"/api/v1/documents/{doc_id}/file", files={"file": (name, data, content_type)}, headers=headers)


# --- create / edit / delete ------------------------------------------------------

@pytest.mark.parametrize("role,status", [("public", 403), ("student", 403),
                                         ("coordinator", 201), ("staff", 201), ("admin", 201)])
def test_create_by_role(client, db_session, cognito, role, status):
    response = client.post("/api/v1/documents/", json={"name": "MoU ใหม่"}, headers=bearer(token_for(client, role)))
    assert response.status_code == status, response.text
    if status == 201:
        body = response.json()
        assert (body["status"], body["isPublished"], body["cstuStatus"]) == ("draft", False, "review")
        assert body["ownerUserId"] == user_id(db_session, role)
        assert audit_actions(db_session, body["id"]) == ["create"]
    else:
        assert db_session.query(models.Document).count() == 0


def test_create_ignores_status_and_publication_fields(client, db_session, cognito):
    response = client.post("/api/v1/documents/", headers=bearer(token_for(client, "coordinator")),
                           json={"name": "Sneaky", "status": "active", "is_published": True, "cstu_status": "keep"})
    assert response.status_code == 201
    doc = db_session.get(models.Document, response.json()["id"])
    assert (doc.status, doc.is_published, doc.cstu_status) == ("draft", False, "review")


@pytest.mark.parametrize("body", [{"name": "  "}, {"name": "x", "partner_id": 999},
                                  {"name": "x", "effective_date": "2026-05-01", "expiry_date": "2026-01-01"}])
def test_create_rejects_invalid_fields(client, db_session, cognito, body):
    response = client.post("/api/v1/documents/", json=body, headers=bearer(token_for(client, "staff")))
    assert response.status_code == 422
    assert db_session.query(models.AuditLog).count() == 0


def test_coordinator_edits_only_own_drafts(client, db_session, cognito):
    headers = bearer(token_for(client, "coordinator"))
    mine = make_doc(db_session, user_id(db_session, "coordinator"))
    theirs = make_doc(db_session, other_coordinator(db_session), name="Theirs")
    approved = make_doc(db_session, user_id(db_session, "coordinator"), name="Approved", status="approved")

    response = client.patch(f"/api/v1/documents/{mine.id}", json={"name": "Renamed"}, headers=headers)
    assert response.status_code == 200 and response.json()["name"] == "Renamed"
    assert client.patch(f"/api/v1/documents/{theirs.id}", json={"name": "Hijacked"}, headers=headers).status_code == 403
    assert client.patch(f"/api/v1/documents/{approved.id}", json={"name": "Late"}, headers=headers).status_code == 409
    db_session.expire_all()
    assert (theirs.name, approved.name) == ("Theirs", "Approved")
    assert audit_actions(db_session, mine.id) == ["update"]
    assert audit_actions(db_session, theirs.id) == audit_actions(db_session, approved.id) == []


@pytest.mark.parametrize("role,status", [("public", 403), ("student", 403), ("staff", 200), ("admin", 200)])
def test_edit_by_role(client, db_session, cognito, role, status):
    doc = make_doc(db_session, status="active")
    response = client.patch(f"/api/v1/documents/{doc.id}", json={"responsible": "ผู้รับผิดชอบใหม่"},
                            headers=bearer(token_for(client, role)))
    assert response.status_code == status


@pytest.mark.parametrize("role,status", [("public", 403), ("student", 403), ("coordinator", 403),
                                         ("staff", 204), ("admin", 204)])
def test_delete_is_soft_and_staff_admin_only(client, db_session, cognito, role, status):
    headers = bearer(token_for(client, role))
    owner = user_id(db_session, role)
    doc = make_doc(db_session, owner, is_published=True)
    assert client.delete(f"/api/v1/documents/{doc.id}", headers=headers).status_code == status
    db_session.refresh(doc)
    assert doc.is_deleted is (status == 204)
    if status == 204:
        assert doc.is_published is False
        assert audit_actions(db_session, doc.id) == ["delete"]
        assert client.patch(f"/api/v1/documents/{doc.id}", json={"name": "x"}, headers=headers).status_code == 404


# --- state machine ----------------------------------------------------------------

ALL_STATUSES = list(TRANSITIONS)
CASES = [(start, end, end in TRANSITIONS[start]) for start in ALL_STATUSES for end in ALL_STATUSES]


@pytest.mark.parametrize("start,end,allowed", CASES, ids=[f"{s}->{e}" for s, e, _ in CASES])
def test_transitions(client, db_session, cognito, start, end, allowed):
    doc = make_doc(db_session, status=start)
    response = client.post(f"/api/v1/documents/{doc.id}/transition", json={"status": end},
                           headers=bearer(token_for(client, "staff")))
    db_session.refresh(doc)
    if allowed:
        assert response.status_code == 200, response.text
        assert doc.status == end
        assert audit_actions(db_session, doc.id) == ["approved" if end == "approved" else "transition"]
    else:
        assert response.status_code == 409
        assert doc.status == start
        assert audit_actions(db_session, doc.id) == []


def test_full_lifecycle_and_legacy_rows_without_status(client, db_session, cognito):
    headers = bearer(token_for(client, "admin"))
    doc = make_doc(db_session, status=None)  # rows from before V3-3 count as drafts
    for status in ("approved", "active", "expired"):
        response = client.post(f"/api/v1/documents/{doc.id}/transition", json={"status": status}, headers=headers)
        assert response.status_code == 200 and response.json()["status"] == status
    assert client.post(f"/api/v1/documents/{doc.id}/transition", json={"status": "bogus"},
                       headers=headers).status_code == 422


@pytest.mark.parametrize("role", ROLES)
def test_only_staff_admin_approve_and_the_creator_cannot(client, db_session, cognito, role):
    headers = bearer(token_for(client, role))
    doc = make_doc(db_session, user_id(db_session, role))  # the caller created it
    response = client.post(f"/api/v1/documents/{doc.id}/transition", json={"status": "approved"}, headers=headers)
    assert response.status_code == STAFF_ONLY[role]
    db_session.refresh(doc)
    assert doc.status == ("approved" if STAFF_ONLY[role] == 200 else "draft")


# --- CSTU review and publication -------------------------------------------------

@pytest.mark.parametrize("role", ROLES)
def test_cstu_review_by_role(client, db_session, cognito, role):
    headers = bearer(token_for(client, role))
    doc = make_doc(db_session, user_id(db_session, role))
    response = client.put(f"/api/v1/documents/{doc.id}/cstu-status",
                          json={"cstu_status": "keep", "cstu_evidence": "CSTU เป็นคู่สัญญา (ข้อ 1)"}, headers=headers)
    assert response.status_code == STAFF_ONLY[role]
    if response.status_code == 200:
        assert response.json()["cstuStatus"] == "keep"
        assert audit_actions(db_session, doc.id) == ["cstu_review"]


@pytest.mark.parametrize("status", ["keep", "out_of_scope"])
def test_cstu_decision_needs_evidence(client, db_session, cognito, status):
    doc = make_doc(db_session)
    response = client.put(f"/api/v1/documents/{doc.id}/cstu-status", json={"cstu_status": status, "cstu_evidence": " "},
                          headers=bearer(token_for(client, "staff")))
    assert response.status_code == 422
    db_session.refresh(doc)
    assert doc.cstu_status == "review"


@pytest.mark.parametrize("role", ROLES)
def test_publish_by_role(client, db_session, cognito, role):
    headers = bearer(token_for(client, role))
    doc = make_doc(db_session, user_id(db_session, role))
    assert client.post(f"/api/v1/documents/{doc.id}/publish", headers=headers).status_code == STAFF_ONLY[role]
    assert client.post(f"/api/v1/documents/{doc.id}/unpublish", headers=headers).status_code == STAFF_ONLY[role]
    expected = ["publish", "unpublish"] if STAFF_ONLY[role] == 200 else []
    assert audit_actions(db_session, doc.id) == expected


def test_public_only_when_published_and_cstu_keep(client, db_session, cognito):
    headers = bearer(token_for(client, "staff"))
    doc = make_doc(db_session, status="active", sources=[models.Source(
        source_url="https://example.test/v3-3", source_type="official_document",
        source_checked_at=datetime.now(timezone.utc), verification_status="verified")])

    def public_ids():
        return [d["id"] for d in client.get("/api/v1/documents/").json()]

    client.post(f"/api/v1/documents/{doc.id}/publish", headers=headers)
    assert doc.id not in public_ids()  # published but still "review"
    client.put(f"/api/v1/documents/{doc.id}/cstu-status", json={"cstu_status": "keep", "cstu_evidence": "e"},
               headers=headers)
    assert doc.id in public_ids()
    client.put(f"/api/v1/documents/{doc.id}/cstu-status", json={"cstu_status": "out_of_scope", "cstu_evidence": "e"},
               headers=headers)
    assert doc.id not in public_ids()
    assert client.get(f"/api/v1/documents/{doc.id}").status_code == 404


def test_manage_list_scopes_coordinators_to_their_own(client, db_session, cognito):
    coordinator = bearer(token_for(client, "coordinator"))
    mine = make_doc(db_session, user_id(db_session, "coordinator"), name="Mine")
    make_doc(db_session, other_coordinator(db_session), name="Theirs")
    deleted = make_doc(db_session, user_id(db_session, "coordinator"), name="Gone", is_deleted=True)
    assert [d["id"] for d in client.get("/api/v1/documents/manage", headers=coordinator).json()] == [mine.id]
    staff_ids = [d["id"] for d in client.get("/api/v1/documents/manage", headers=bearer(token_for(client, "staff"))).json()]
    assert mine.id in staff_ids and deleted.id not in staff_ids and len(staff_ids) == 2
    for role in ("public", "student"):
        assert client.get("/api/v1/documents/manage", headers=bearer(token_for(client, role))).status_code == 403


# --- file upload -------------------------------------------------------------------

@pytest.mark.parametrize("role,status", [("public", 403), ("student", 403),
                                         ("coordinator", 200), ("staff", 200), ("admin", 200)])
def test_upload_by_role(client, db_session, cognito, role, status):
    headers = bearer(token_for(client, role))
    doc = make_doc(db_session, user_id(db_session, role))
    response = upload(client, doc.id, headers)
    assert response.status_code == status, response.text
    db_session.refresh(doc)
    if status == 200:
        assert (doc.file_availability, doc.size_bytes, doc.mime_type) == ("available", len(PDF), "application/pdf")
        assert storage.get_file(doc.storage_key) == PDF
        assert audit_actions(db_session, doc.id) == ["upload"]
    else:
        assert doc.storage_key is None


def test_coordinator_cannot_upload_to_others_or_non_drafts(client, db_session, cognito):
    headers = bearer(token_for(client, "coordinator"))
    theirs = make_doc(db_session, other_coordinator(db_session))
    approved = make_doc(db_session, user_id(db_session, "coordinator"), status="approved")
    assert upload(client, theirs.id, headers).status_code == 403
    assert upload(client, approved.id, headers).status_code == 409


@pytest.mark.parametrize("data,content_type", [
    (b"plain text", "text/plain"),
    (b"MZ fake exe pretending", "application/pdf"),  # declared PDF, bytes are not
    (PDF, "image/png"),
    (b"", "application/pdf"),
])
def test_upload_rejects_non_pdf(client, db_session, cognito, tmp_path, data, content_type):
    doc = make_doc(db_session)
    response = upload(client, doc.id, bearer(token_for(client, "staff")), data, content_type)
    assert response.status_code == 415
    db_session.refresh(doc)
    assert doc.storage_key is None and not list(tmp_path.rglob("*.pdf"))


def test_upload_rejects_files_over_the_limit(client, db_session, cognito, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", len(PDF) - 1)
    doc = make_doc(db_session)
    response = upload(client, doc.id, bearer(token_for(client, "staff")))
    assert response.status_code == 413
    db_session.refresh(doc)
    assert doc.storage_key is None and not list(tmp_path.rglob("*.pdf"))


def test_default_upload_limit_is_10_mb():
    assert settings.MAX_UPLOAD_BYTES == 10 * 1024 * 1024


def test_replacing_a_file_removes_the_old_object(client, db_session, cognito):
    headers = bearer(token_for(client, "staff"))
    doc = make_doc(db_session)
    upload(client, doc.id, headers, name="v1.pdf")
    db_session.refresh(doc)
    old_key = doc.storage_key
    new_pdf = PDF + b"% version 2\n"
    assert upload(client, doc.id, headers, data=new_pdf, name="v2.pdf").status_code == 200
    db_session.refresh(doc)
    assert doc.storage_key != old_key and doc.file_name == "v2.pdf"
    assert storage.get_file(doc.storage_key) == new_pdf
    with pytest.raises(storage.StorageError):
        storage.get_file(old_key)
    assert audit_actions(db_session, doc.id) == ["upload", "replace_file"]


# --- internal download links ------------------------------------------------------

def _doc_with_file(db, owner_id=None):
    key = storage.build_storage_key("internal.pdf")
    storage.put_file(key, PDF)
    return make_doc(db, owner_id, file_availability="available", storage_key=key, file_name="internal.pdf",
                    mime_type="application/pdf", size_bytes=len(PDF))


@pytest.mark.parametrize("role,status", [("public", 403), ("student", 403),
                                         ("coordinator", 200), ("staff", 200), ("admin", 200)])
def test_internal_url_by_role(client, db_session, cognito, role, status):
    headers = bearer(token_for(client, role))
    doc = _doc_with_file(db_session, user_id(db_session, role))  # unpublished, internal
    response = client.get(f"/api/v1/documents/{doc.id}/internal-url", headers=headers)
    assert response.status_code == status
    if status == 200:
        assert response.json()["expiresIn"] == storage.PRESIGNED_TTL_SECONDS
        download = client.get(response.json()["url"])
        assert download.status_code == 200 and download.content == PDF
    # The public download never serves an internal document.
    assert client.get(f"/api/v1/documents/{doc.id}/download").status_code == 404


def test_coordinator_cannot_get_link_to_others_document(client, db_session, cognito):
    doc = _doc_with_file(db_session, other_coordinator(db_session))
    response = client.get(f"/api/v1/documents/{doc.id}/internal-url", headers=bearer(token_for(client, "coordinator")))
    assert response.status_code == 403


def test_signed_link_rejects_tampering_and_expiry(client, db_session, cognito):
    doc = _doc_with_file(db_session)
    url = client.get(f"/api/v1/documents/{doc.id}/internal-url", headers=bearer(token_for(client, "staff"))).json()["url"]
    query = parse_qs(urlparse(url).query)
    expires, signature = int(query["expires"][0]), query["signature"][0]
    base = f"/api/v1/documents/{doc.id}/signed-download"
    assert client.get(base, params={"expires": expires + 60, "signature": signature}).status_code == 403
    assert client.get(base, params={"expires": expires, "signature": "0" * 64}).status_code == 403
    past = int(time.time()) - 1
    assert client.get(base, params={"expires": past, "signature": storage.sign_local(doc.storage_key, past)}).status_code == 403
    other = _doc_with_file(db_session)  # a valid signature for one document does not open another
    assert client.get(f"/api/v1/documents/{other.id}/signed-download",
                      params={"expires": expires, "signature": signature}).status_code == 403


def test_s3_backend_returns_a_presigned_url(monkeypatch):
    calls = []

    class FakeS3:
        def generate_presigned_url(self, operation, Params, ExpiresIn):
            calls.append((operation, Params, ExpiresIn))
            return "https://bucket.s3.example/signed"

    monkeypatch.setattr(settings, "STORAGE_BACKEND", "s3")
    monkeypatch.setattr(settings, "S3_BUCKET", "cstu-test-bucket")
    monkeypatch.setattr(storage, "_s3_client", lambda: FakeS3())
    assert storage.presigned_url("documents/x/mou.pdf", "mou.pdf", 120) == "https://bucket.s3.example/signed"
    operation, params, expires_in = calls[0]
    assert (operation, params["Bucket"], params["Key"], expires_in) == (
        "get_object", "cstu-test-bucket", "documents/x/mou.pdf", 120)


# --- audit coverage -----------------------------------------------------------------

def test_every_document_write_leaves_an_audit_row_naming_the_user(client, db_session, cognito):
    headers = bearer(token_for(client, "staff"))
    staff_id = user_id(db_session, "staff")
    doc_id = client.post("/api/v1/documents/", json={"name": "Audited MoU"}, headers=headers).json()["id"]
    client.patch(f"/api/v1/documents/{doc_id}", json={"responsible": "x"}, headers=headers)
    upload(client, doc_id, headers)
    client.put(f"/api/v1/documents/{doc_id}/cstu-status", json={"cstu_status": "keep", "cstu_evidence": "e"},
               headers=headers)
    client.post(f"/api/v1/documents/{doc_id}/transition", json={"status": "approved"}, headers=headers)
    client.post(f"/api/v1/documents/{doc_id}/publish", headers=headers)
    client.post(f"/api/v1/documents/{doc_id}/unpublish", headers=headers)
    client.delete(f"/api/v1/documents/{doc_id}", headers=headers)
    assert audit_actions(db_session, doc_id) == [
        "create", "update", "upload", "cstu_review", "approved", "publish", "unpublish", "delete"]
    rows = db_session.query(models.AuditLog).filter_by(entity="documents", entity_id=doc_id).all()
    assert all(row.user_id == staff_id for row in rows)
