from datetime import date, datetime, timezone
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload, selectinload, with_loader_criteria
from typing import List
from sqlalchemy import and_
from public_visibility import partner_criteria, document_criteria

import database
import models
import schemas
import storage
from storage import StorageError

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {"application/pdf"}


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
    date_to: date | None = None, db: Session = Depends(database.get_db),
):
    """Inclusive overlap with the agreement's effective period.

    Unknown boundaries do not match a requested boundary.
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not exceed date_to")
    query = _public_documents(db)
    if search and search.strip():
        query = query.filter(models.Document.name.ilike(f"%{search.strip()}%"))
    if status:
        query = query.filter(models.Document.status == status)
    if doc_type:
        query = query.filter(models.Document.doc_type == doc_type)
    if date_from:
        query = query.filter(models.Document.expiry_date >= date_from)
    if date_to:
        query = query.filter(models.Document.effective_date <= date_to)
    return [_response(doc) for doc in query.order_by(models.Document.id.desc()).all()]


@router.get("/{document_id}", response_model=schemas.DocumentResponse,
            responses={404: {"model": schemas.ErrorResponse}})
def get_document(document_id: int, db: Session = Depends(database.get_db)):
    doc = _public_documents(db).filter(models.Document.id == document_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return _response(doc)


@router.post("/", response_model=schemas.DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    name: str = None,
    db: Session = Depends(database.get_db),
):
    """Upload a PDF. Bytes go to the storage backend (S3 or local disk);
    only metadata is stored in the database."""
    data = await file.read()

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Only PDF files are allowed")

    key = storage.build_storage_key(file.filename)
    try:
        storage.put_file(key, data)
    except StorageError as e:
        raise HTTPException(status_code=500, detail=str(e))

    doc = models.Document(
        name=name or file.filename,
        storage_key=key,
        file_name=file.filename,
        uploaded_at=datetime.now(timezone.utc).replace(tzinfo=None),
        mime_type=file.content_type,
        size_bytes=len(data),
        document_kind="other",
        file_availability="available",
        # Keep new uploads private until their provenance is attached and verified.
        is_published=False,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


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


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(database.get_db)):
    """Delete a document row and best-effort delete its file from storage."""
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        if doc.storage_key:
            storage.delete_file(doc.storage_key)
    except StorageError:
        pass  # keep DB consistent even if the blob already vanished

    db.delete(doc)
    db.commit()
