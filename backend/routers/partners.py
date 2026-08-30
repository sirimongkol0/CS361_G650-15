from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import database
import models
import schemas

router = APIRouter(prefix="/partners", tags=["partners"])


@router.get("/", response_model=List[schemas.PartnerResponse])
def list_published_partners(db: Session = Depends(database.get_db)):
    """List all published partners."""
    partners = db.query(models.Partner).filter(
        models.Partner.is_published == True
    ).all()
    return partners


@router.get("/{partner_id}", response_model=schemas.PartnerResponse)
def get_partner(partner_id: int, db: Session = Depends(database.get_db)):
    """Get a specific published partner by ID. Returns 404 if not found or draft."""
    partner = db.query(models.Partner).filter(
        models.Partner.id == partner_id,
        models.Partner.is_published == True
    ).first()

    if partner is None:
        raise HTTPException(status_code=404, detail="Partner not found")

    return partner
