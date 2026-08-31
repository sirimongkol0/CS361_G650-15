from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import database
import models
import schemas

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[schemas.AdminProfileResponse])
def list_users(db: Session = Depends(database.get_db)):
    """List admin/staff profiles."""
    rows = db.query(models.AdminProfile).order_by(models.AdminProfile.id).all()
    return rows


@router.get("/{user_id}", response_model=schemas.AdminProfileResponse)
def get_user(user_id: int, db: Session = Depends(database.get_db)):
    """Retrieve a single admin/staff profile by ID."""
    row = db.query(models.AdminProfile).filter(
        models.AdminProfile.id == user_id
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return row
