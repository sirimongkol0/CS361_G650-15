from fastapi import APIRouter, Depends, HTTPException, Request, Response
from public_visibility import partner_criteria
from sqlalchemy.orm import Session, selectinload
from typing import List, Literal

import database
import models
import schemas

router = APIRouter(prefix="/partners", tags=["partners"])


@router.get("/", response_model=List[schemas.PartnerResponse])
def list_published_partners(
    search: str | None = None, partner_type: str | None = None,
    country: str | None = None,
    scope_level: Literal["program", "faculty", "university"] | None = None,
    db: Session = Depends(database.get_db),
):
    """List published partners that have complete identity data and a verified source."""
    query = db.query(models.Partner).options(
        selectinload(models.Partner.sources)
    ).filter(
        *partner_criteria(),
    )
    if search and search.strip():
        query = query.filter(models.Partner.name.ilike(f"%{search.strip()}%"))
    if partner_type:
        query = query.filter(models.Partner.type == partner_type)
    if country:
        query = query.filter(models.Partner.country == country)
    if scope_level:
        query = query.filter(models.Partner.scope_level == scope_level)
    partners = query.order_by(models.Partner.id.asc()).all()
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
        *partner_criteria(),
    ).first()

    if partner is None:
        raise HTTPException(status_code=404, detail="Partner not found")

    return _response(partner)


@router.get("/{partner_id}/logo", responses={404: {"model": schemas.ErrorResponse}})
def get_partner_logo(partner_id: int, request: Request, db: Session = Depends(database.get_db)):
    """Serve the stored logo image of a published partner. Returns 404 if none is stored."""
    logo = db.query(models.PartnerLogo).join(
        models.Partner, models.Partner.id == models.PartnerLogo.partner_id
    ).filter(
        models.PartnerLogo.partner_id == partner_id,
        *partner_criteria(),
    ).first()
    if logo is None:
        raise HTTPException(status_code=404, detail="Logo not found")
    # Browsers revalidate every time (cheap 304), so a replaced logo shows up immediately.
    etag = f'"{partner_id}-{int(logo.updated_at.timestamp())}"'
    headers = {"Cache-Control": "no-cache", "ETag": etag}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=logo.data, media_type=logo.mime_type, headers=headers)
