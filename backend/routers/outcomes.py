from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, joinedload

import audit
import auth
import database
import models
import schemas
from public_visibility import document_criteria, partner_criteria
from routers.feedback import _optional_user

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


MANAGER_ROLES = ("staff", "admin")

# Each context an outcome can hang off: (outcome column, context model, public criteria).
_CONTEXTS = (
    (models.Outcome.partner_id, models.Partner, partner_criteria),
    (models.Outcome.document_id, models.Document, document_criteria),
    (models.Outcome.activity_id, models.Activity,
     lambda: (models.Activity.is_published.is_(True), models.Activity.is_deleted.is_(False))),
    (models.Outcome.exchange_id, models.ExchangeStudent,
     lambda: (models.ExchangeStudent.is_published.is_(True),)),
)


def _publicly_visible():
    """Published, and every context it is linked to is itself public."""
    return and_(
        models.Outcome.is_published.is_(True),
        *(or_(column.is_(None), column.in_(select(model.id).where(*criteria())))
          for column, model, criteria in _CONTEXTS),
    )


def _owned_by(user: models.User):
    """Linked to at least one context the coordinator owns."""
    return or_(*(column.in_(select(model.id).where(model.owner_user_id == user.id))
                 for column, model, _ in _CONTEXTS))


def _visible_query(db: Session, user: Optional[models.User]):
    query = db.query(models.Outcome).options(joinedload(models.Outcome.outcome_type)).filter(
        models.Outcome.is_deleted.is_(False))
    if user is not None and user.role in MANAGER_ROLES:
        return query
    if user is not None and user.role == "coordinator":
        return query.filter(or_(_publicly_visible(), _owned_by(user)))
    return query.filter(_publicly_visible())


def _response(row: models.Outcome) -> schemas.OutcomeResponse:
    item = schemas.OutcomeResponse.model_validate(row)
    if item.unit is None:
        item.unit = row.outcome_type.unit
    return item


@router.get("/", response_model=schemas.OutcomePage)
def list_outcomes(
    partner_id: Optional[int] = None,
    activity_id: Optional[int] = None,
    document_id: Optional[int] = None,
    exchange_id: Optional[int] = None,
    outcome_type_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(database.get_db),
    user: Optional[models.User] = Depends(_optional_user),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be on or before date_to")
    query = _visible_query(db, user)
    for column, value in ((models.Outcome.partner_id, partner_id), (models.Outcome.activity_id, activity_id),
                          (models.Outcome.document_id, document_id), (models.Outcome.exchange_id, exchange_id),
                          (models.Outcome.outcome_type_id, outcome_type_id)):
        if value is not None:
            query = query.filter(column == value)
    if date_from is not None:
        query = query.filter(models.Outcome.occurred_on >= date_from)
    if date_to is not None:
        query = query.filter(models.Outcome.occurred_on <= date_to)
    total = query.count()
    rows = (query.order_by(models.Outcome.occurred_on.desc(), models.Outcome.id.desc())
            .offset((page - 1) * page_size).limit(page_size).all())
    return schemas.OutcomePage(items=[_response(row) for row in rows], total=total, page=page, page_size=page_size)


@router.get("/{outcome_id}", response_model=schemas.OutcomeResponse)
def get_outcome(
    outcome_id: int,
    db: Session = Depends(database.get_db),
    user: Optional[models.User] = Depends(_optional_user),
):
    row = _visible_query(db, user).filter(models.Outcome.id == outcome_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Outcome not found")
    return _response(row)
