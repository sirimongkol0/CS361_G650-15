from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import database
import models
import schemas

router = APIRouter(prefix="/exchange", tags=["exchange"])


@router.get("/", response_model=List[schemas.ExchangeStudentResponse])
def list_exchange_students(db: Session = Depends(database.get_db)):
    """List all published exchange student records."""
    rows = db.query(models.ExchangeStudent).filter(
        models.ExchangeStudent.is_published == True  # noqa: E712
    ).order_by(models.ExchangeStudent.id).all()
    return rows


@router.get("/{student_id}", response_model=schemas.ExchangeStudentResponse)
def get_exchange_student(student_id: int, db: Session = Depends(database.get_db)):
    """Retrieve a single published exchange student record by ID."""
    row = db.query(models.ExchangeStudent).filter(
        models.ExchangeStudent.id == student_id,
        models.ExchangeStudent.is_published == True  # noqa: E712
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Exchange student not found")
    return row
