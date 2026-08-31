from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

import database
import models
import schemas

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("/", response_model=List[schemas.ActivityResponse])
def list_published_activities(db: Session = Depends(database.get_db)):
    """List all published activities ordered by date ascending."""
    activities = db.query(models.Activity).options(
        joinedload(models.Activity.partner)
    ).filter(
        models.Activity.is_published == True
    ).order_by(
        models.Activity.date.asc()
    ).all()
    
    result = []
    for activity in activities:
        activity_dict = {
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
            "mou_document_id": activity.mou_document_id,
            "partner": None
        }
        if activity.partner:
            activity_dict["partner"] = {
                "id": activity.partner.id,
                "name": activity.partner.name
            }
        result.append(activity_dict)
    return result


@router.get("/{activity_id}", response_model=schemas.ActivityResponse)
def get_activity(activity_id: int, db: Session = Depends(database.get_db)):
    """Get a specific published activity by ID. Returns 404 if not found or draft."""
    activity = db.query(models.Activity).options(
        joinedload(models.Activity.partner)
    ).filter(
        models.Activity.id == activity_id,
        models.Activity.is_published == True
    ).first()
    
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    activity_dict = {
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
        "mou_document_id": activity.mou_document_id,
        "partner": None
    }
    if activity.partner:
        activity_dict["partner"] = {
            "id": activity.partner.id,
            "name": activity.partner.name
        }
    return activity_dict
