from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import database
import models
import schemas
import auth
import audit

router = APIRouter(prefix="/exchange", tags=["exchange"])


def _visible_query(db: Session, user: models.User):
    query = db.query(models.ExchangeStudent)
    if user.role in ("staff", "admin"):
        return query
    if user.role in ("student", "coordinator"):
        return query.filter(models.ExchangeStudent.owner_user_id == user.id)
    return query.filter(models.ExchangeStudent.is_published.is_(True))


@router.get("/", response_model=List[schemas.ExchangeStudentResponse])
def list_exchange_students(db: Session = Depends(database.get_db)):
    """Public endpoint: only published exchange records are visible."""
    return db.query(models.ExchangeStudent).filter(
        models.ExchangeStudent.is_published.is_(True)
    ).order_by(models.ExchangeStudent.id).all()


@router.get("/mine", response_model=List[schemas.ExchangeStudentResponse])
def list_my_exchange_students(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("student", "coordinator", "staff", "admin")),
):
    """Authenticated view: student/coordinator see their own; staff/admin see all."""
    query = db.query(models.ExchangeStudent)
    if user.role == "student":
        query = query.filter(models.ExchangeStudent.user_id == user.id)
    elif user.role == "coordinator":
        query = query.filter(models.ExchangeStudent.owner_user_id == user.id)
    return query.order_by(models.ExchangeStudent.id).all()


@router.get("/mine/{student_id}", response_model=schemas.ExchangeStudentResponse)
def get_my_exchange_student(
    student_id: int, db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("student", "coordinator", "staff", "admin")),
):
    query = db.query(models.ExchangeStudent).filter(models.ExchangeStudent.id == student_id)
    if user.role == "student":
        query = query.filter(models.ExchangeStudent.user_id == user.id)
    elif user.role == "coordinator":
        query = query.filter(models.ExchangeStudent.owner_user_id == user.id)
    row = query.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Exchange student not found")
    return row


@router.get("/{student_id}", response_model=schemas.ExchangeStudentResponse)
def get_exchange_student(student_id: int, db: Session = Depends(database.get_db)):
    """Public endpoint: retrieve a single published record only."""
    row = db.query(models.ExchangeStudent).filter(
        models.ExchangeStudent.id == student_id,
        models.ExchangeStudent.is_published.is_(True),
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Exchange student not found")
    return row


@router.post("/", response_model=schemas.ExchangeStudentResponse, status_code=201)
def create_exchange_student(
    body: schemas.ExchangeStudentCreate, db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    data = body.model_dump()
    student_user_id = data.pop("user_id", None)
    if student_user_id is not None:
        student_user = db.get(models.User, student_user_id)
        if student_user is None or student_user.role != "student":
            raise HTTPException(status_code=422, detail="user_id must reference an existing student account")
    if user.role == "coordinator":
        data["is_published"] = False
    row = models.ExchangeStudent(**data, user_id=student_user_id, owner_user_id=user.id)
    db.add(row)
    db.flush()
    audit.record(db, user, "create", "exchange_students", row.id, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{student_id}", response_model=schemas.ExchangeStudentResponse)
def update_exchange_student(
    student_id: int, body: schemas.ExchangeStudentUpdate, db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    row = db.query(models.ExchangeStudent).filter(models.ExchangeStudent.id == student_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Exchange student not found")
    if user.role not in ("staff", "admin") and row.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    data = body.model_dump(exclude_unset=True)
    if user.role == "coordinator" and data.get("is_published") is True:
        raise HTTPException(status_code=403, detail="Only staff/admin can publish exchange records")
    before = audit.snapshot(row)
    for key, value in data.items():
        setattr(row, key, value)
    audit.record(db, user, "update", "exchange_students", row.id, before=before, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row
