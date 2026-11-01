from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import audit
import auth
import database
import models
import schemas

router = APIRouter(prefix="/users", tags=["users"])

# Accounts are created in Cognito and recorded here on first login; roles follow
# the Cognito group. Admins can switch an account on or off; managers can pick
# a student account to link to an exchange record.


@router.get("/", response_model=List[schemas.UserResponse])
def list_users(
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role("admin")),
):
    """Every account that has signed in, with role and last login."""
    return db.query(models.User).order_by(models.User.email).all()


@router.get("/students", response_model=List[schemas.StudentOption])
def list_students(
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    """Active student accounts, for linking an exchange record to its student."""
    return db.query(models.User).filter(
        models.User.role == "student", models.User.is_active.is_(True),
    ).order_by(models.User.email).all()


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


@router.patch("/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int, body: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.require_role("admin")),
):
    """Enable or disable an account; a disabled account gets 403 on every request."""
    row = db.get(models.User, user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if row.id == admin.id and body.is_active is False:
        raise HTTPException(status_code=422, detail="ปิดการใช้งานบัญชีของตนเองไม่ได้")
    before = audit.snapshot(row)
    row.is_active = body.is_active
    audit.record(db, admin, "update", "users", row.id, before=before, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row
