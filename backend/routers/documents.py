from datetime import date
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload, selectinload, with_loader_criteria
from typing import List, Literal
from sqlalchemy import and_, or_
from public_visibility import partner_criteria, document_criteria

import database
import models
import schemas
import storage
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


