"""V4-7 (#100): renew, revise or terminate an agreement, and the chain of versions per partner."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import audit
import auth
import database
import models
import schemas
from routers.insights import AGREEMENT_TYPES

router = APIRouter(prefix="/renewals", tags=["renewals"])

# Copied into the renewal draft; dates, file, status and publication start fresh.
COPIED = ("name", "doc_type", "document_kind", "partner_id", "responsible",
          "signer_our", "signer_partner", "scope_level", "cstu_status", "cstu_evidence")


def _agreement(db: Session, document_id: int) -> models.Document:
    doc = db.query(models.Document).filter(
        models.Document.id == document_id, models.Document.is_deleted.is_(False),
        models.Document.doc_type.in_(AGREEMENT_TYPES)).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return doc


def _version(doc: models.Document) -> dict:
    return {
        "id": doc.id, "name": doc.name, "docType": doc.doc_type, "status": doc.status,
        "effectiveDate": doc.effective_date, "expiryDate": doc.expiry_date,
        "renewsDocumentId": doc.renews_document_id, "decision": doc.renewal_decision,
        "reason": doc.renewal_reason, "decidedAt": doc.renewal_decided_at,
        "decidedByUserId": doc.renewal_decided_by_user_id,
    }


@router.post("/documents/{document_id}/decision", status_code=201)
def decide(
    document_id: int, body: schemas.RenewalDecisionCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("staff", "admin")),
):
    """Record the decision once. renew/revise also create a draft that copies the agreement
    and points back to it; revise means the draft will be edited before approval."""
    doc = _agreement(db, document_id)
    successor = db.query(models.Document.id).filter(
        models.Document.renews_document_id == doc.id, models.Document.is_deleted.is_(False)).first()
    if doc.renewal_decision is not None or successor is not None:
        raise HTTPException(status_code=409, detail="A renewal decision was already recorded")
    if (doc.status or "draft") in ("draft", "cancelled"):
        raise HTTPException(status_code=409, detail="Only approved or live agreements can be renewed")

    before = audit.snapshot(doc)
    doc.renewal_decision = body.decision
    doc.renewal_reason = body.reason
    doc.renewal_decided_by_user_id = user.id
    doc.renewal_decided_at = auth.utcnow()
    audit.record(db, user, "renewal_decision", "documents", doc.id, before=before, after=audit.snapshot(doc))

    renewal = None
    if body.decision != "terminate":
        renewal = models.Document(**{key: getattr(doc, key) for key in COPIED}, status="draft",
                                  is_published=False, owner_user_id=user.id, renews_document_id=doc.id)
        renewal.scope_items = [models.DocumentScopeItem(position=item.position, text=item.text)
                               for item in doc.scope_items]
        db.add(renewal)
        db.flush()
        audit.record(db, user, "create", "documents", renewal.id, after=audit.snapshot(renewal))
    db.commit()
    return {"document": _version(doc), "renewal": _version(renewal) if renewal else None}


@router.get("/partners/{partner_id}")
def partner_chains(
    partner_id: int, db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role("staff", "admin")),
):
    """Each chain runs from the first version to the current one."""
    if db.query(models.Partner).filter_by(id=partner_id, is_deleted=False).first() is None:
        raise HTTPException(status_code=404, detail="Partner not found")
    docs = (db.query(models.Document)
            .filter(models.Document.partner_id == partner_id, models.Document.is_deleted.is_(False),
                    models.Document.doc_type.in_(AGREEMENT_TYPES))
            .order_by(models.Document.effective_date.is_(None), models.Document.effective_date,
                      models.Document.id).all())
    by_id = {doc.id: doc for doc in docs}
    next_of = {doc.renews_document_id: doc for doc in docs if doc.renews_document_id in by_id}
    chains = []
    for doc in docs:
        if doc.renews_document_id in by_id:
            continue  # not the first version
        chain = [doc]
        while chain[-1].id in next_of and len(chain) <= len(docs):
            chain.append(next_of[chain[-1].id])
        chains.append([_version(version) for version in chain])
    return {"partnerId": partner_id, "chains": chains}
