from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from typing import List

import database
import models
import schemas

router = APIRouter(prefix="/partners", tags=["partners"])


@router.get("/", response_model=List[schemas.PartnerResponse])
def list_published_partners(db: Session = Depends(database.get_db)):
    """List published partners that have complete identity data and a verified source."""
    partners = db.query(models.Partner).options(
        selectinload(models.Partner.sources)
    ).filter(
        models.Partner.is_published.is_(True),
        func.length(func.trim(models.Partner.name)) > 0,
        func.length(func.trim(models.Partner.type)) > 0,
        func.length(func.trim(models.Partner.description)) > 0,
        func.length(func.trim(models.Partner.website_url)) > 0,
        models.Partner.country_code.is_not(None),
        models.Partner.sources.any(models.Source.verification_status == "verified"),
    ).all()
    return [_response(partner) for partner in partners]


def _response(partner: models.Partner):
    result = schemas.PartnerResponse.model_validate(partner)
    if not partner.contact_is_public:
        result.contactName = None
        result.contactEmail = None
    result.sources = [
        schemas.SourceResponse.model_validate(source)
        for source in partner.sources
        if source.verification_status == "verified"
    ]
    return result


@router.get(
    "/{partner_id}",
    response_model=schemas.PartnerResponse,
    responses={404: {"model": schemas.ErrorResponse}},
)
def get_partner(partner_id: int, db: Session = Depends(database.get_db)):
    """Get a specific published partner by ID. Returns 404 if not found or draft."""
    partner = db.query(models.Partner).options(
        selectinload(models.Partner.sources)
    ).filter(
        models.Partner.id == partner_id,
        models.Partner.is_published.is_(True),
        func.length(func.trim(models.Partner.name)) > 0,
        func.length(func.trim(models.Partner.type)) > 0,
        func.length(func.trim(models.Partner.description)) > 0,
        func.length(func.trim(models.Partner.website_url)) > 0,
        models.Partner.country_code.is_not(None),
        models.Partner.sources.any(models.Source.verification_status == "verified"),
    ).first()

    if partner is None:
        raise HTTPException(status_code=404, detail="Partner not found")

    return _response(partner)
