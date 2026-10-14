from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload, selectinload, with_loader_criteria
from datetime import date
from typing import List, Literal

from public_visibility import partner_criteria, document_criteria

import database
import models
import schemas
import auth
import audit

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
        "date_kind": activity.date_kind,
        "date_precision": activity.date_precision,
        "sources": [schemas.SourceResponse.model_validate(source)
                    for source in activity.sources if source.verification_status == "verified"],
        "end_date": activity.end_date,
        "participants": activity.participants,
        "location": activity.location,
        "time": activity.time,
        "status": activity.status,
        "is_open": activity.is_open,
        "scope_level": activity.scope_level,
        "mou_document_id": (activity.mou_document_id
                            if activity.mou_document and activity.mou_document.is_published else None),
        "partner": public_partner,
    }


@router.get("/", response_model=List[schemas.ActivityResponse])
def list_published_activities(
    search: str | None = None,
    activity_type: str | None = None,
    status: str | None = None,
    scope_level: Literal["program", "faculty", "university"] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(database.get_db),
):
    """List, search and filter published activities."""

    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not exceed date_to")

    query = (
        db.query(models.Activity)
        .options(
            joinedload(models.Activity.partner),
            selectinload(models.Activity.sources),
            joinedload(models.Activity.mou_document),
            with_loader_criteria(models.Partner, and_(*partner_criteria())),
            with_loader_criteria(models.Document, and_(*document_criteria())),
        )
        .filter(models.Activity.is_published.is_(True), models.Activity.is_deleted.is_(False))
    )

    # Match only publicly eligible partner names, just as in the response.
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            models.Activity.name.ilike(term),
            models.Activity.partner.has(and_(
                *partner_criteria(), models.Partner.name.ilike(term),
            )),
        ))

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

    # Filter by cooperation level (invalid values are rejected with 422)
    if scope_level:
        query = query.filter(
            models.Activity.scope_level == scope_level
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
        joinedload(models.Activity.partner), joinedload(models.Activity.mou_document),
        selectinload(models.Activity.sources),
        with_loader_criteria(models.Partner, and_(*partner_criteria())),
        with_loader_criteria(models.Document, and_(*document_criteria())),
    ).filter(
        models.Activity.id == activity_id,
        models.Activity.is_published.is_(True),
        models.Activity.is_deleted.is_(False),
    ).first()
    
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    return _public_activity(activity)


def _can_manage_activity(activity: models.Activity, user: models.User) -> bool:
    if user.role in ("staff", "admin"):
        return True
    return user.role == "coordinator" and activity.owner_user_id == user.id


@router.post("/", response_model=schemas.ActivityResponse, status_code=201)
def create_activity(
    body: schemas.ActivityCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    data = body.model_dump()
    if user.role == "coordinator":
        # Coordinators can create records, but publication remains a staff/admin action.
        data["is_published"] = False
    row = models.Activity(**data, owner_user_id=user.id)
    db.add(row)
    db.flush()
    audit.record(db, user, "create", "activities", row.id, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{activity_id}", response_model=schemas.ActivityResponse)
def update_activity(
    activity_id: int, body: schemas.ActivityUpdate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    row = db.query(models.Activity).filter(models.Activity.id == activity_id, models.Activity.is_deleted.is_(False)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    if not _can_manage_activity(row, user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    data = body.model_dump(exclude_unset=True)
    if user.role == "coordinator" and "is_published" in data:
        raise HTTPException(status_code=403, detail="Only staff/admin can change publication status")
    before = audit.snapshot(row)
    for key, value in data.items():
        setattr(row, key, value)
    audit.record(db, user, "update", "activities", row.id, before=before, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{activity_id}", status_code=204)
def delete_activity(
    activity_id: int, db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("staff", "admin")),
):
    row = db.query(models.Activity).filter(models.Activity.id == activity_id, models.Activity.is_deleted.is_(False)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    before = audit.snapshot(row)
    row.is_deleted = True
    row.is_published = False
    audit.record(db, user, "delete", "activities", row.id, before=before, after=audit.snapshot(row))
    db.commit()
    return None
