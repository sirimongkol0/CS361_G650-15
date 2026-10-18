import time
from datetime import date
from urllib.parse import quote
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload, selectinload, with_loader_criteria
from typing import List, Literal
from sqlalchemy import and_, or_
from public_visibility import partner_criteria, document_criteria

import audit
import auth
import database
import models
import schemas
import storage
from config import settings
from storage import StorageError

router = APIRouter(prefix="/documents", tags=["documents"])

def public_document_conditions():
    return document_criteria()


def _public_documents(db):
    return db.query(models.Document).options(
        joinedload(models.Document.partner).selectinload(models.Partner.sources), selectinload(models.Document.scope_items),
        selectinload(models.Document.sources),
        with_loader_criteria(models.Partner, and_(*partner_criteria())),
    ).filter(*public_document_conditions())


def _response(doc):
    response = schemas.DocumentResponse.model_validate(doc)
    response.sources = [schemas.SourceResponse.model_validate(source)
                        for source in doc.sources if source.verification_status == "verified"]
    partner = doc.partner
    visible = partner is not None
    response.partnerId = partner.id if visible else None
    response.partner = schemas.ActivityPartnerResponse(id=partner.id, name=partner.name) if visible else None
    return response


@router.get("/", response_model=List[schemas.DocumentResponse])
def list_documents(
    search: str | None = None, status: str | None = None,
    doc_type: str | None = None, date_from: date | None = None,
    date_to: date | None = None,
    scope_level: Literal["program", "faculty", "university"] | None = None,
    db: Session = Depends(database.get_db),
):
    """Inclusive overlap with the agreement's effective period.

    Unknown boundaries do not match a requested boundary.
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not exceed date_to")
    query = _public_documents(db)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            models.Document.name.ilike(term),
            models.Document.partner.has(and_(
                *partner_criteria(), models.Partner.name.ilike(term),
            )),
        ))
    if status:
        query = query.filter(models.Document.status == status)
    if doc_type:
        query = query.filter(models.Document.doc_type == doc_type)
    if scope_level:
        query = query.filter(models.Document.scope_level == scope_level)
    if date_from:
        query = query.filter(models.Document.expiry_date >= date_from)
    if date_to:
        query = query.filter(models.Document.effective_date <= date_to)
    return [_response(doc) for doc in query.order_by(models.Document.id.desc()).all()]


def _can_manage(doc: models.Document, user: models.User) -> bool:
    """coordinator: only documents they own; staff/admin: every document."""
    if user.role in ("staff", "admin"):
        return True
    return user.role == "coordinator" and doc.owner_user_id == user.id


def _managed_document(db, document_id: int, user: models.User) -> models.Document:
    doc = db.query(models.Document).filter(
        models.Document.id == document_id, models.Document.is_deleted.is_(False),
    ).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _can_manage(doc, user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return doc


def _manage_response(doc: models.Document) -> schemas.DocumentManageResponse:
    return schemas.DocumentManageResponse.model_validate(doc)


@router.get("/manage", response_model=List[schemas.DocumentManageResponse])
def list_managed_documents(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    """Internal list including drafts: coordinators see their own, staff/admin see all."""
    query = db.query(models.Document).options(
        joinedload(models.Document.partner), selectinload(models.Document.sources),
        selectinload(models.Document.scope_items),
    ).filter(models.Document.is_deleted.is_(False))
    if user.role == "coordinator":
        query = query.filter(models.Document.owner_user_id == user.id)
    return [_manage_response(doc) for doc in query.order_by(models.Document.id.desc()).all()]


@router.get("/{document_id}", response_model=schemas.DocumentResponse,
            responses={404: {"model": schemas.ErrorResponse}})
def get_document(document_id: int, db: Session = Depends(database.get_db)):
    doc = _public_documents(db).filter(models.Document.id == document_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return _response(doc)


@router.get("/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(database.get_db)):
    """Download a document by streaming its bytes from the storage backend."""
    doc = _public_documents(db).filter(
        models.Document.id == document_id,
        models.Document.file_availability == "available",
    ).first()
    if doc is None or not doc.storage_key:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        data = storage.get_file(doc.storage_key)
    except StorageError as e:
        raise HTTPException(status_code=404, detail=str(e))

    filename = doc.file_name or doc.storage_key.rsplit("/", 1)[-1]
    return Response(
        content=data,
        media_type=doc.mime_type or "application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"document-{doc.id}.pdf\"; filename*=UTF-8''{quote(filename, safe='')}"},
    )


# ------------------------------------------------------------- V3-3 writes
#
# Every write checks the role with require_role, the owner for coordinators,
# and saves an audit row in the same commit as the change.

# draft -> approved -> active -> expired, and cancelled from any open state.
# "expiring" is an active agreement close to its expiry date.
TRANSITIONS = {
    "draft": {"approved", "cancelled"},
    "approved": {"active", "cancelled"},
    "active": {"expired", "cancelled"},
    "expiring": {"expired", "cancelled"},
    "expired": set(),
    "cancelled": set(),
}


def _current_status(doc: models.Document) -> str:
    return doc.status or "draft"  # rows from before V3-3 may have no status


def _validate_fields(db, doc: models.Document):
    if doc.partner_id is not None and db.query(models.Partner).filter(
        models.Partner.id == doc.partner_id, models.Partner.is_deleted.is_(False),
    ).first() is None:
        raise HTTPException(status_code=422, detail="partner_id does not exist")
    if doc.effective_date and doc.expiry_date and doc.expiry_date < doc.effective_date:
        raise HTTPException(status_code=422, detail="expiry_date must not be before effective_date")


@router.post("/", response_model=schemas.DocumentManageResponse, status_code=201)
def create_document(
    body: schemas.DocumentCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    doc = models.Document(**body.model_dump(), status="draft", is_published=False,
                          cstu_status="review", owner_user_id=user.id)
    _validate_fields(db, doc)
    db.add(doc)
    db.flush()
    audit.record(db, user, "create", "documents", doc.id, after=audit.snapshot(doc))
    db.commit()
    db.refresh(doc)
    return _manage_response(doc)


@router.patch("/{document_id}", response_model=schemas.DocumentManageResponse)
def update_document(
    document_id: int, body: schemas.DocumentUpdate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    doc = _managed_document(db, document_id, user)
    if user.role == "coordinator" and _current_status(doc) != "draft":
        raise HTTPException(status_code=409, detail="Only draft documents can be edited")
    before = audit.snapshot(doc)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(doc, key, value)
    _validate_fields(db, doc)
    audit.record(db, user, "update", "documents", doc.id, before=before, after=audit.snapshot(doc))
    db.commit()
    db.refresh(doc)
    return _manage_response(doc)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int, db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("staff", "admin")),
):
    doc = _managed_document(db, document_id, user)
    before = audit.snapshot(doc)
    doc.is_deleted = True
    doc.is_published = False
    audit.record(db, user, "delete", "documents", doc.id, before=before, after=audit.snapshot(doc))
    db.commit()
    return None


@router.post("/{document_id}/transition", response_model=schemas.DocumentManageResponse)
def transition_document(
    document_id: int, body: schemas.DocumentTransition,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("staff", "admin")),
):
    """Approve or change the agreement status; the creator (coordinator) cannot approve."""
    doc = _managed_document(db, document_id, user)
    current = _current_status(doc)
    if body.status not in TRANSITIONS[current]:
        raise HTTPException(status_code=409, detail=f"Cannot change status from {current} to {body.status}")
    before = audit.snapshot(doc)
    doc.status = body.status
    audit.record(db, user, body.status if body.status == "approved" else "transition", "documents",
                 doc.id, before=before, after=audit.snapshot(doc))
    db.commit()
    db.refresh(doc)
    return _manage_response(doc)


@router.put("/{document_id}/cstu-status", response_model=schemas.DocumentManageResponse)
def review_cstu_status(
    document_id: int, body: schemas.DocumentCstuReview,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("staff", "admin")),
):
    """Record whether the document belongs to CSTU (docs/decisions/cstu-program-scope.md).

    A decision other than "review" must cite its evidence so it can be checked later.
    """
    evidence = (body.cstu_evidence or "").strip() or None
    if body.cstu_status != "review" and evidence is None:
        raise HTTPException(status_code=422, detail="cstu_evidence is required for keep and out_of_scope")
    doc = _managed_document(db, document_id, user)
    before = audit.snapshot(doc)
    doc.cstu_status = body.cstu_status
    doc.cstu_evidence = evidence
    audit.record(db, user, "cstu_review", "documents", doc.id, before=before, after=audit.snapshot(doc))
    db.commit()
    db.refresh(doc)
    return _manage_response(doc)


def _set_published(db, document_id: int, user: models.User, published: bool):
    doc = _managed_document(db, document_id, user)
    if doc.is_published != published:
        before = audit.snapshot(doc)
        doc.is_published = published
        audit.record(db, user, "publish" if published else "unpublish", "documents", doc.id,
                     before=before, after=audit.snapshot(doc))
        db.commit()
        db.refresh(doc)
    return _manage_response(doc)


@router.post("/{document_id}/publish", response_model=schemas.DocumentManageResponse)
def publish_document(
    document_id: int, db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("staff", "admin")),
):
    """Allow publication. It shows publicly only once cstu_status is also "keep"."""
    return _set_published(db, document_id, user, True)


@router.post("/{document_id}/unpublish", response_model=schemas.DocumentManageResponse)
def unpublish_document(
    document_id: int, db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("staff", "admin")),
):
    return _set_published(db, document_id, user, False)


@router.put("/{document_id}/file", response_model=schemas.DocumentManageResponse)
def upload_document_file(
    document_id: int, file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    """Upload or replace the document's PDF (bytes go to S3/local storage, never the DB)."""
    doc = _managed_document(db, document_id, user)
    if user.role == "coordinator" and _current_status(doc) != "draft":
        raise HTTPException(status_code=409, detail="Only draft documents can be edited")
    limit = settings.MAX_UPLOAD_BYTES
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=413, detail=f"File is larger than {limit} bytes")
    # Trust the bytes, not just the declared type: a PDF starts with "%PDF-".
    if file.content_type != "application/pdf" or not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="Only PDF files are accepted")

    old_key = doc.storage_key
    key = storage.build_storage_key(file.filename or "document.pdf")
    try:
        storage.put_file(key, data)
    except StorageError as e:
        raise HTTPException(status_code=502, detail=str(e))
    before = audit.snapshot(doc)
    doc.storage_key = key
    doc.file_name = file.filename or "document.pdf"
    doc.mime_type = "application/pdf"
    doc.size_bytes = len(data)
    doc.uploaded_at = auth.utcnow()
    doc.file_availability = "available"
    audit.record(db, user, "replace_file" if old_key else "upload", "documents", doc.id,
                 before=before, after=audit.snapshot(doc))
    try:
        db.commit()
    except Exception:
        storage.delete_file(key)
        raise
    if old_key and old_key != key:
        storage.delete_file(old_key)  # only after the new file is saved and committed
    db.refresh(doc)
    return _manage_response(doc)


@router.get("/{document_id}/internal-url", response_model=schemas.DocumentInternalUrlResponse)
def internal_document_url(
    document_id: int, request: Request,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    """Short-lived download link for any document the user may manage, published or not."""
    doc = _managed_document(db, document_id, user)
    if not doc.storage_key:
        raise HTTPException(status_code=404, detail="Document has no file")
    ttl = storage.PRESIGNED_TTL_SECONDS
    filename = doc.file_name or doc.storage_key.rsplit("/", 1)[-1]
    url = storage.presigned_url(doc.storage_key, filename, ttl)
    if url is None:  # local backend: sign our own link
        expires = int(time.time()) + ttl
        signature = storage.sign_local(doc.storage_key, expires)
        url = str(request.url_for("signed_download", document_id=doc.id).include_query_params(
            expires=expires, signature=signature))
    return {"url": url, "expiresIn": ttl}


@router.get("/{document_id}/signed-download", name="signed_download",
            responses={403: {"model": schemas.ErrorResponse}, 404: {"model": schemas.ErrorResponse}})
def signed_download(document_id: int, expires: int, signature: str, db: Session = Depends(database.get_db)):
    """Local-backend stand-in for an S3 presigned URL; the signature is the permission."""
    doc = db.query(models.Document).filter(
        models.Document.id == document_id, models.Document.is_deleted.is_(False),
    ).first()
    if doc is None or not doc.storage_key:
        raise HTTPException(status_code=404, detail="Document not found")
    if not storage.verify_local(doc.storage_key, expires, signature):
        raise HTTPException(status_code=403, detail="Link is invalid or has expired")
    try:
        data = storage.get_file(doc.storage_key)
    except StorageError as e:
        raise HTTPException(status_code=404, detail=str(e))
    filename = doc.file_name or doc.storage_key.rsplit("/", 1)[-1]
    return Response(
        content=data, media_type=doc.mime_type or "application/pdf",
        headers={"Content-Disposition": f"attachment; filename=\"document-{doc.id}.pdf\"; filename*=UTF-8''{quote(filename, safe='')}"},
    )
