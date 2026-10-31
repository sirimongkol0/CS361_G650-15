from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import audit
import auth
import database
import models
import schemas

router = APIRouter(prefix="/outcomes", tags=["outcomes"])


def _types_query(db: Session):
    return db.query(models.OutcomeType).order_by(models.OutcomeType.sort_order, models.OutcomeType.id)


@router.get("/types", response_model=List[schemas.OutcomeTypeResponse])
def list_outcome_types(db: Session = Depends(database.get_db)):
    """Active outcome types for the outcome form; admins add new ones without a code change."""
    return _types_query(db).filter(models.OutcomeType.is_active.is_(True)).all()


@router.get("/lookups", response_model=List[schemas.OutcomeTypeResponse])
def list_outcome_lookups(
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role("admin")),
):
    """All outcome types, inactive included, for the admin settings page."""
    return _types_query(db).all()


@router.post("/lookups", response_model=schemas.OutcomeTypeResponse, status_code=201)
def create_outcome_lookup(
    body: schemas.OutcomeTypeCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("admin")),
):
    if db.query(models.OutcomeType).filter_by(code=body.code).first() is not None:
        raise HTTPException(status_code=409, detail="Lookup code already exists")
    row = models.OutcomeType(**body.model_dump(), is_active=True)
    db.add(row)
    db.flush()
    audit.record(db, user, "create", "outcome_types", row.id, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.patch("/lookups/{lookup_id}", response_model=schemas.OutcomeTypeResponse)
def update_outcome_lookup(
    lookup_id: int,
    body: schemas.OutcomeTypeUpdate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("admin")),
):
    row = db.get(models.OutcomeType, lookup_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Outcome type not found")
    before = audit.snapshot(row)
    for field, value in body.model_dump(exclude_unset=True).items():
        # unit may be cleared; the other fields are required on the row.
        if value is not None or field == "unit":
            setattr(row, field, value)
    audit.record(db, user, "update", "outcome_types", row.id, before=before, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row
