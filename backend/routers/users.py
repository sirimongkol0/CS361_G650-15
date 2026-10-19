from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import auth
import database
import models
import schemas

router = APIRouter(prefix="/users", tags=["users"])

# Accounts are created in Cognito and recorded here on first login; roles follow
# the Cognito group. This router only reads them (admin only).


@router.get("/", response_model=List[schemas.UserResponse])
def list_users(
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role("admin")),
):
    """Every account that has signed in, with role and last login."""
    return db.query(models.User).order_by(models.User.email).all()


@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role("admin")),
):
    row = db.get(models.User, user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return row
