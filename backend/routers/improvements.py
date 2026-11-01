"""V4-6 (#99): improvements made because of feedback (the "Act" step of PDCA).

Staff/admin manage every improvement. A coordinator manages only improvements whose
linked feedback is all about partners, agreements, activities or exchange records
they own. Improvements are not public. Feedback linked to an improvement is marked
``reviewed``.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

import audit
import auth
import database
import models
import schemas

router = APIRouter(prefix="/improvements", tags=["improvements"])

MANAGER_ROLES = ("staff", "admin")
EDITOR_ROLES = ("coordinator", *MANAGER_ROLES)

Feedback, Improvement, link = models.Feedback, models.Improvement, models.feedback_improvements


def coordinator_feedback_scope(user: models.User):
    """Feedback about a partner, agreement, activity or exchange record the coordinator owns."""
    return or_(
        Feedback.partner_id.in_(select(models.Partner.id).where(
            models.Partner.owner_user_id == user.id, models.Partner.is_deleted.is_(False))),
        Feedback.document_id.in_(select(models.Document.id).where(
            models.Document.owner_user_id == user.id, models.Document.is_deleted.is_(False))),
        Feedback.activity_id.in_(select(models.Activity.id).where(
            models.Activity.owner_user_id == user.id, models.Activity.is_deleted.is_(False))),
        Feedback.exchange_id.in_(select(models.ExchangeStudent.id).where(
            models.ExchangeStudent.owner_user_id == user.id)),
    )


def _outside_scope(user: models.User):
    """Improvement ids linked to at least one feedback the coordinator does not own."""
    return (select(link.c.improvement_id).join(Feedback, Feedback.id == link.c.feedback_id)
            .where(~coordinator_feedback_scope(user)))


def _visible(db: Session, user: models.User):
    query = db.query(Improvement).options(selectinload(Improvement.feedbacks))
    if user.role == "coordinator":
        query = query.filter(Improvement.id.not_in(_outside_scope(user)))
    return query


def _year_column():
    return func.coalesce(Improvement.action_date, func.date(Improvement.created_at))


def _snapshot(row: Improvement) -> dict:
    return {**audit.snapshot(row), "feedback_ids": [f.id for f in row.feedbacks]}


def _load_feedbacks(db: Session, user: models.User, ids: List[int]) -> List[models.Feedback]:
    ids = sorted(set(ids))
    rows = db.query(Feedback).filter(Feedback.id.in_(ids)).all()
    if len(rows) != len(ids):
        raise HTTPException(status_code=422, detail="feedback_ids must reference existing feedback")
    if user.role == "coordinator":
        owned = db.query(func.count(Feedback.id)).filter(
            Feedback.id.in_(ids), coordinator_feedback_scope(user)).scalar()
        if owned != len(ids):
            raise HTTPException(status_code=403, detail="Feedback is outside your scope")
    for row in rows:
        if row.status == "pending":
            row.status = "reviewed"
    return rows


def _get_visible(db: Session, user: models.User, improvement_id: int) -> Improvement:
    row = _visible(db, user).filter(Improvement.id == improvement_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Improvement not found")
    return row


@router.get("/feedback-options", response_model=List[schemas.ImprovementFeedback])
def list_feedback_options(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*EDITOR_ROLES)),
):
    """Feedback the caller may link an improvement to (a coordinator's own scope only)."""
    query = db.query(Feedback)
    if user.role == "coordinator":
        query = query.filter(coordinator_feedback_scope(user))
    return query.order_by(Feedback.date.desc().nullslast(), Feedback.id.desc()).all()


@router.get("/", response_model=List[schemas.ImprovementResponse])
def list_improvements(
    feedback_id: Optional[int] = None,
    status: Optional[schemas.ImprovementStatus] = None,
    year: Optional[int] = None,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*EDITOR_ROLES)),
):
    query = _visible(db, user)
    if feedback_id is not None:
        query = query.filter(Improvement.id.in_(
            select(link.c.improvement_id).where(link.c.feedback_id == feedback_id)))
    if status is not None:
        query = query.filter(Improvement.status == status)
    if year is not None:
        year_date = _year_column()
        query = query.filter(year_date >= date(year, 1, 1), year_date <= date(year, 12, 31))
    return query.order_by(Improvement.action_date.desc().nullslast(), Improvement.id.desc()).all()


@router.get("/{improvement_id}", response_model=schemas.ImprovementResponse)
def get_improvement(
    improvement_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*EDITOR_ROLES)),
):
    return _get_visible(db, user, improvement_id)


@router.post("/", response_model=schemas.ImprovementResponse, status_code=201)
def create_improvement(
    body: schemas.ImprovementCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*EDITOR_ROLES)),
):
    data = body.model_dump(exclude={"feedback_ids"})
    row = Improvement(**data, feedbacks=_load_feedbacks(db, user, body.feedback_ids),
                      created_by_user_id=user.id, created_at=auth.utcnow())
    db.add(row)
    db.flush()
    audit.record(db, user, "create", "improvements", row.id, after=_snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{improvement_id}", response_model=schemas.ImprovementResponse)
def update_improvement(
    improvement_id: int,
    body: schemas.ImprovementUpdate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*EDITOR_ROLES)),
):
    row = _get_visible(db, user, improvement_id)
    before = _snapshot(row)
    data = body.model_dump(exclude_unset=True)
    if "feedback_ids" in data:
        row.feedbacks = _load_feedbacks(db, user, data.pop("feedback_ids") or [])
    for field, value in data.items():
        # Optional text may be cleared; title and status are required on the row.
        if value is not None or field in ("description", "action_date", "responsible"):
            setattr(row, field, value)
    row.updated_at = auth.utcnow()
    audit.record(db, user, "update", "improvements", row.id, before=before, after=_snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{improvement_id}", status_code=204)
def delete_improvement(
    improvement_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    row = db.get(Improvement, improvement_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Improvement not found")
    audit.record(db, user, "delete", "improvements", row.id, before=_snapshot(row))
    db.delete(row)
    db.commit()
