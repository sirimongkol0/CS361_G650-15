from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List

import database
import models
import schemas
import storage
from storage import StorageError

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {"application/pdf"}


@router.get("/", response_model=List[schemas.DocumentResponse])
def list_documents(db: Session = Depends(database.get_db)):
    """List all published documents."""
    docs = db.query(models.Document).filter(
        models.Document.is_published == True  # noqa: E712
    ).order_by(models.Document.id.desc()).all()
    return docs


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
        mime_type=file.content_type,
        size_bytes=len(data),
        is_published=True,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(database.get_db)):
    """Download a document by streaming its bytes from the storage backend."""
    doc = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.is_published == True  # noqa: E712
    ).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        data = storage.get_file(doc.storage_key)
    except StorageError as e:
        raise HTTPException(status_code=404, detail=str(e))

    filename = doc.storage_key.rsplit("/", 1)[-1]
    return Response(
        content=data,
        media_type=doc.mime_type or "application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(database.get_db)):
    """Delete a document row and best-effort delete its file from storage."""
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        storage.delete_file(doc.storage_key)
    except StorageError:
        pass  # keep DB consistent even if the blob already vanished

    db.delete(doc)
    db.commit()
