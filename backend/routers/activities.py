from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload
from datetime import date
from typing import List

import database
import models
import schemas

router = APIRouter(prefix="/activities", tags=["activities"])


def _public_activity(activity: models.Activity) -> dict:
    """Project an ORM activity onto the public contract.

    A published activity may still reference a draft partner.  In that case
    the relationship must not reveal the draft partner through the public API.
    """
    partner = activity.partner
    public_partner = None
    if partner is not None and partner.is_published:
        public_partner = {"id": partner.id, "name": partner.name}

    return {
        "id": activity.id,
        "name": activity.name,
        "date": activity.date,
        "description": activity.description,
        "activity_type": activity.activity_type,
        "end_date": activity.end_date,
        "participants": activity.participants,
        "location": activity.location,
        "time": activity.time,
        "status": activity.status,
        "is_open": activity.is_open,
        "mou_document_id": (activity.mou_document_id
                            if activity.mou_document and activity.mou_document.is_published else None),
        "partner": public_partner,
    }


@router.get("/", response_model=List[schemas.ActivityResponse])
def list_published_activities(
    search: str | None = None,
    activity_type: str | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(database.get_db),
):
    """List, search and filter published activities."""

    query = (
        db.query(models.Activity)
        .options(
            joinedload(models.Activity.partner),
            joinedload(models.Activity.mou_document),
        )
        .filter(models.Activity.is_published.is_(True))
    )

    # Search by activity name
    if search and search.strip():
        query = query.filter(
            models.Activity.name.ilike(
                f"%{search.strip()}%"
            )
        )

    # Filter by activity type
    if activity_type:
        query = query.filter(
            models.Activity.activity_type == activity_type
        )

    # Filter by status
    if status:
        query = query.filter(
            models.Activity.status == status
        )

    # The activity must end on or after date_from.
    # If there is no end_date, use the activity start date.
    if date_from:
        query = query.filter(
            or_(
                models.Activity.end_date >= date_from,
                and_(
                    models.Activity.end_date.is_(None),
                    models.Activity.date >= date_from,
                ),
            )
        )

    # The activity must start on or before date_to.
    if date_to:
        query = query.filter(
            models.Activity.date <= date_to
        )

    activities = (
        query
        .order_by(models.Activity.date.asc())
        .all()
    )

    return [
        _public_activity(activity)
        for activity in activities
    ]


@router.get(
    "/{activity_id}",
    response_model=schemas.ActivityResponse,
    responses={404: {"model": schemas.ErrorResponse}},
)
def get_activity(activity_id: int, db: Session = Depends(database.get_db)):
    """Get a specific published activity by ID. Returns 404 if not found or draft."""
    activity = db.query(models.Activity).options(
        joinedload(models.Activity.partner), joinedload(models.Activity.mou_document)
    ).filter(
        models.Activity.id == activity_id,
        models.Activity.is_published.is_(True),
    ).first()
    
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    return _public_activity(activity)
