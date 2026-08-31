from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import database
import models
import schemas

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.get("/", response_model=List[schemas.FeedbackResponse])
def list_feedback(db: Session = Depends(database.get_db)):
    """List all published feedback entries, newest first."""
    rows = db.query(models.Feedback).filter(
        models.Feedback.is_published == True  # noqa: E712
    ).order_by(models.Feedback.date.desc(), models.Feedback.id).all()
    return rows


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
