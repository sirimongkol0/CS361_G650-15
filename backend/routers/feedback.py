from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import audit
import auth
import database
import models
import schemas

router = APIRouter(prefix="/feedback", tags=["feedback"])

MANAGER_ROLES = ("coordinator", "staff", "admin")


@router.get("/", response_model=List[schemas.FeedbackResponse])
def list_feedback(db: Session = Depends(database.get_db)):
    """List all published feedback entries, newest first."""
    rows = db.query(models.Feedback).filter(
        models.Feedback.is_published == True  # noqa: E712
    ).order_by(models.Feedback.date.desc(), models.Feedback.id).all()
    return rows


@router.get("/manage", response_model=List[schemas.FeedbackManageResponse])
def list_feedback_for_managers(
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    """Signed-in view: every entry, published or not, with its reply."""
    return db.query(models.Feedback).order_by(models.Feedback.date.desc(), models.Feedback.id).all()


@router.get("/{feedback_id}", response_model=schemas.FeedbackResponse)
def get_feedback(feedback_id: int, db: Session = Depends(database.get_db)):
    """Retrieve a single published feedback entry by ID."""
    row = db.query(models.Feedback).filter(
        models.Feedback.id == feedback_id,
        models.Feedback.is_published == True  # noqa: E712
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return row


@router.patch("/{feedback_id}", response_model=schemas.FeedbackManageResponse)
def update_feedback(
    feedback_id: int, body: schemas.FeedbackUpdate, db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    """Record a reply and/or status. Publishing and unpublishing are staff/admin only."""
    row = db.get(models.Feedback, feedback_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    data = body.model_dump(exclude_unset=True)
    if "is_published" in data and user.role not in ("staff", "admin"):
        raise HTTPException(status_code=403, detail="Only staff/admin can publish feedback")
    if data.get("is_published") is None:
        data.pop("is_published", None)
    if data.get("status") is None:
        data.pop("status", None)
    before = audit.snapshot(row)
    if "reply" in data:
        reply = (data.pop("reply") or "").strip() or None
        if reply != row.reply:
            row.reply = reply
            row.replied_at = auth.utcnow() if reply else None
            row.replied_by_user_id = user.id if reply else None
    for key, value in data.items():
        setattr(row, key, value)
    audit.record(db, user, "update", "feedbacks", row.id, before=before, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row
