from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import audit
import auth
import database
import models
import schemas

router = APIRouter(prefix="/feedback", tags=["feedback"])

SUBMITTER_ROLES = ("student", "coordinator", "staff", "admin")
MANAGER_ROLES = ("staff", "admin")
_optional_bearer = HTTPBearer(auto_error=False)


def _optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    db: Session = Depends(database.get_db),
) -> Optional[models.User]:
    """Public reads work without a token; a supplied token must be valid."""
    if credentials is None:
        return None
    claims = auth.decode_token(credentials.credentials, "access")
    if db.get(models.RevokedToken, claims["jti"]) is not None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(models.User).filter_by(cognito_sub=claims["sub"]).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    token_role = auth.role_from_groups(claims.get("cognito:groups"))
    if user.role != token_role:
        user.role = token_role
        db.commit()
    return user


def _feedback_query(db: Session, source_id=None, respondent_type_id=None, partner_id=None,
                    activity_id=None, document_id=None, exchange_id=None, status=None,
                    date_from=None, date_to=None):
    query = db.query(models.Feedback)
    if source_id is not None:
        query = query.filter(models.Feedback.feedback_source_id == source_id)
    if respondent_type_id is not None:
        query = query.filter(models.Feedback.respondent_type_id == respondent_type_id)
    for field, value in (("partner_id", partner_id), ("activity_id", activity_id),
                         ("document_id", document_id), ("exchange_id", exchange_id)):
        if value is not None:
            query = query.filter(getattr(models.Feedback, field) == value)
    if status is not None:
        query = query.filter(models.Feedback.status == status)
    if date_from is not None:
        query = query.filter(models.Feedback.date >= date_from)
    if date_to is not None:
        query = query.filter(models.Feedback.date <= date_to)
    return query.order_by(models.Feedback.date.desc(), models.Feedback.id.desc())


@router.get("/respondent-types")
def list_respondent_types(db: Session = Depends(database.get_db)):
    """Active respondent categories available to the signed-in web form."""
    return db.query(models.RespondentType).filter(models.RespondentType.is_active.is_(True)).order_by(
        models.RespondentType.sort_order, models.RespondentType.id
    ).all()


def _lookup_model(kind: str):
    lookup_models = {
        "respondent-types": models.RespondentType,
        "sources": models.FeedbackSource,
    }
    lookup_model = lookup_models.get(kind)
    if lookup_model is None:
        raise HTTPException(status_code=404, detail="Feedback lookup type not found")
    return lookup_model


@router.get("/lookups", response_model=None)
def list_feedback_lookups(
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role("admin")),
):
    """Lookup values for the admin feedback settings page."""
    def rows_for(model):
        rows = db.query(model).order_by(model.sort_order, model.id).all()
        return [schemas.FeedbackLookupResponse.model_validate(row).model_dump() for row in rows]

    return {
        "respondentTypes": rows_for(models.RespondentType),
        "feedbackSources": rows_for(models.FeedbackSource),
    }


@router.post("/lookups/{kind}", response_model=schemas.FeedbackLookupResponse, status_code=201)
def create_feedback_lookup(
    kind: str,
    body: schemas.FeedbackLookupCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("admin")),
):
    lookup_model = _lookup_model(kind)
    if db.query(lookup_model).filter_by(code=body.code).first() is not None:
        raise HTTPException(status_code=409, detail="Lookup code already exists")
    row = lookup_model(code=body.code, name_th=body.name_th, sort_order=body.sort_order, is_active=True)
    db.add(row)
    db.flush()
    audit.record(db, user, "create", lookup_model.__tablename__, row.id, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.patch("/lookups/{kind}/{lookup_id}", response_model=schemas.FeedbackLookupResponse)
def update_feedback_lookup(
    kind: str,
    lookup_id: int,
    body: schemas.FeedbackLookupUpdate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("admin")),
):
    lookup_model = _lookup_model(kind)
    row = db.get(lookup_model, lookup_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Feedback lookup not found")
    before = audit.snapshot(row)
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(row, field, value)
    audit.record(db, user, "update", lookup_model.__tablename__, row.id,
                 before=before, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.get("/", response_model=None)
def list_feedback(
    source_id: Optional[int] = None,
    feedback_source_id: Optional[int] = None,
    respondent_type_id: Optional[int] = None,
    partner_id: Optional[int] = None,
    activity_id: Optional[int] = None,
    document_id: Optional[int] = None,
    exchange_id: Optional[int] = None,
    status: Optional[schemas.FeedbackStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(database.get_db),
    user: Optional[models.User] = Depends(_optional_user),
):
    """Public sees published rows; only staff/admin can filter the full inbox."""
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be on or before date_to")
    if source_id is not None and feedback_source_id is not None and source_id != feedback_source_id:
        raise HTTPException(status_code=422, detail="source_id and feedback_source_id must match")
    query = _feedback_query(db, feedback_source_id if feedback_source_id is not None else source_id,
                            respondent_type_id, partner_id, activity_id,
                            document_id, exchange_id, status, date_from, date_to)
    if user is None or user.role not in MANAGER_ROLES:
        # Public callers cannot use filters to infer anything about hidden submissions.
        return [schemas.FeedbackResponse.model_validate(row).model_dump(by_alias=True)
                for row in query.filter(models.Feedback.is_published.is_(True)).all()]
    payload = []
    for row in query.all():
        item = schemas.FeedbackManagerResponse.model_validate(row).model_dump(by_alias=True)
        # The legacy free-text `source` may identify the submitter. Only expose the
        # normalized channel code in the manager view.
        item["source"] = row.feedback_source.code if row.feedback_source else None
        item["respondentTypeName"] = row.respondent_type.name_th if row.respondent_type else None
        payload.append(item)
    return payload


@router.get("/mine", response_model=List[schemas.FeedbackMineResponse])
def list_my_feedback(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*SUBMITTER_ROLES)),
):
    query = db.query(models.Feedback)
    if user.role in ("student", "coordinator"):
        query = query.filter(models.Feedback.submitted_by_user_id == user.id)
    return query.order_by(models.Feedback.date.desc(), models.Feedback.id.desc()).all()


@router.get("/manage", response_model=List[schemas.FeedbackManagerResponse])
def list_feedback_for_managers(
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    """Compatibility alias for the feedback inbox; filtered inbox uses GET /."""
    return _feedback_query(db).all()


@router.get("/{feedback_id}", response_model=schemas.FeedbackResponse)
def get_feedback(feedback_id: int, db: Session = Depends(database.get_db)):
    row = db.query(models.Feedback).filter(
        models.Feedback.id == feedback_id,
        models.Feedback.is_published.is_(True),
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return row


@router.post("/", response_model=schemas.FeedbackMineResponse, status_code=201)
def create_feedback(
    body: schemas.FeedbackCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*SUBMITTER_ROLES)),
):
    """Signed-in stakeholders submit feedback; imported feedback uses V4-4."""
    context = (body.partner_id, body.activity_id, body.document_id, body.exchange_id)
    if not any(value is not None for value in context):
        raise HTTPException(status_code=422, detail="At least one feedback context is required")
    respondent = db.get(models.RespondentType, body.respondent_type_id)
    source = db.query(models.FeedbackSource).filter_by(code="web_form", is_active=True).first()
    if respondent is None or not respondent.is_active:
        raise HTTPException(status_code=422, detail="respondent_type_id must reference an active respondent type")
    if source is None:
        raise HTTPException(status_code=503, detail="Feedback web form source is not configured")
    for model, value, name in (
        (models.Partner, body.partner_id, "partner_id"),
        (models.Activity, body.activity_id, "activity_id"),
        (models.Document, body.document_id, "document_id"),
        (models.ExchangeStudent, body.exchange_id, "exchange_id"),
    ):
        if value is not None and db.get(model, value) is None:
            raise HTTPException(status_code=422, detail=f"{name} must reference an existing record")
    row = models.Feedback(
        title=body.title,
        rating=body.rating,
        date=body.date or date.today(),
        comment=body.comment,
        status="pending",
        is_published=False,
        partner_id=body.partner_id,
        activity_id=body.activity_id,
        document_id=body.document_id,
        exchange_id=body.exchange_id,
        respondent_type_id=respondent.id,
        feedback_source_id=source.id,
        submitted_by_user_id=user.id,
    )
    db.add(row)
    db.flush()
    audit.record(db, user, "create", "feedbacks", row.id, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{feedback_id}", response_model=schemas.FeedbackManageResponse)
def update_feedback(
    feedback_id: int,
    body: schemas.FeedbackUpdate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    """Record a reply and/or review status. Publication has dedicated routes."""
    row = db.get(models.Feedback, feedback_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    data = body.model_dump(exclude_unset=True)
    if "is_published" in data:
        raise HTTPException(status_code=422, detail="Use the publish or unpublish endpoint")
    if data.get("status") is None:
        data.pop("status", None)
    before = audit.snapshot(row)
    if "reply" in data:
        reply = (data.pop("reply") or "").strip() or None
        if reply != row.reply:
            row.reply = reply
            row.replied_at = auth.utcnow() if reply else None
            row.replied_by_user_id = user.id if reply else None
    for key, value in data.items():
        setattr(row, key, value)
    audit.record(db, user, "update", "feedbacks", row.id, before=before, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


def _set_published(feedback_id: int, published: bool, db: Session, user: models.User):
    row = db.get(models.Feedback, feedback_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    before = audit.snapshot(row)
    row.is_published = published
    audit.record(db, user, "publish" if published else "unpublish", "feedbacks", row.id,
                 before=before, after=audit.snapshot(row))
    db.commit()
    db.refresh(row)
    return row


@router.post("/{feedback_id}/publish", response_model=schemas.FeedbackManageResponse)
def publish_feedback(feedback_id: int, db: Session = Depends(database.get_db),
                     user: models.User = Depends(auth.require_role("staff", "admin"))):
    return _set_published(feedback_id, True, db, user)


@router.post("/{feedback_id}/unpublish", response_model=schemas.FeedbackManageResponse)
def unpublish_feedback(feedback_id: int, db: Session = Depends(database.get_db),
                       user: models.User = Depends(auth.require_role("staff", "admin"))):
    return _set_published(feedback_id, False, db, user)
