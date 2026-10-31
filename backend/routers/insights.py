"""V4-5 (#90): summary figures for reports and dashboards, aggregated in SQL."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

import database
import models
from auth import require_role

router = APIRouter(prefix="/insights", tags=["insights"])

EXPIRING_WITHIN_DAYS = 90
AGREEMENT_TYPES = ("mou", "moa")


def _month(db: Session, column):
    """'YYYY-MM' for a date column; SQLite (tests) and PostgreSQL (RDS) spell this differently."""
    if db.get_bind().dialect.name == "sqlite":
        return func.strftime("%Y-%m", column)
    return func.to_char(column, "YYYY-MM")


def _date_range(year, date_from, date_to):
    if year is not None:
        if date_from or date_to:
            raise HTTPException(status_code=422, detail="year cannot be combined with date_from/date_to")
        return date(year, 1, 1), date(year, 12, 31)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to")
    return date_from, date_to


class _Scope:
    """Applies the shared date range and stakeholder-type filters to one query."""

    def __init__(self, date_from, date_to, stakeholder_type):
        self.date_from, self.date_to, self.stakeholder_type = date_from, date_to, stakeholder_type

    def apply(self, query, model, date_column=None):
        if date_column is not None:
            if self.date_from:
                query = query.filter(date_column >= self.date_from)
            if self.date_to:
                query = query.filter(date_column <= self.date_to)
        if self.stakeholder_type:
            query = query.join(models.Partner, model.partner_id == models.Partner.id).filter(
                models.Partner.type == self.stakeholder_type, models.Partner.is_deleted.is_(False))
        return query


def _keyed(rows):
    return [{"key": key, "count": count} for key, count in rows]


def _lookup_counts(db, scope, lookup, fk_column):
    query = (db.query(lookup.code, lookup.name_th, func.count(models.Feedback.id))
             .select_from(models.Feedback).join(lookup, fk_column == lookup.id))
    rows = scope.apply(query, models.Feedback, models.Feedback.date).group_by(lookup.code, lookup.name_th)
    return [{"key": code, "label": label, "count": count} for code, label, count in rows]


@router.get("/summary")
def summary(
    year: int | None = Query(None, ge=1900, le=2999),
    date_from: date | None = None,
    date_to: date | None = None,
    stakeholder_type: str | None = None,
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(require_role("staff", "admin")),
):
    """Collaboration figures for staff/admin reports. Dated figures follow the date filters;
    partner counts and expiring agreements describe the current state."""
    date_from, date_to = _date_range(year, date_from, date_to)
    scope = _Scope(date_from, date_to, stakeholder_type)
    Partner, Document, Activity = models.Partner, models.Document, models.Activity
    Outcome, Feedback = models.Outcome, models.Feedback

    partners = db.query(Partner.type, func.count(Partner.id)).filter(Partner.is_deleted.is_(False))
    if stakeholder_type:
        partners = partners.filter(Partner.type == stakeholder_type)
    partners = partners.group_by(Partner.type).order_by(func.count(Partner.id).desc())

    agreements = db.query(Document).filter(Document.doc_type.in_(AGREEMENT_TYPES), Document.is_deleted.is_(False))
    agreements = scope.apply(agreements, Document)
    by_status = agreements.with_entities(Document.status, func.count(Document.id)).group_by(Document.status)

    today = date.today()
    expiring = (agreements.outerjoin(Partner, Document.partner_id == Partner.id) if not stakeholder_type else agreements)
    expiring = (expiring.filter(Document.expiry_date >= today,
                                Document.expiry_date <= today + timedelta(days=EXPIRING_WITHIN_DAYS))
                .with_entities(Document.id, Document.name, Document.expiry_date, Partner.id, Partner.name)
                .order_by(Document.expiry_date))

    month = _month(db, Activity.date)
    activities = scope.apply(db.query(month, func.count(Activity.id)), Activity, Activity.date)
    activities = activities.filter(Activity.is_deleted.is_(False), Activity.date.isnot(None)).group_by(month).order_by(month)

    outcomes = (db.query(models.OutcomeType.code, models.OutcomeType.name_th, func.count(Outcome.id),
                         func.coalesce(func.sum(Outcome.value), 0))
                .select_from(Outcome).join(models.OutcomeType, Outcome.outcome_type_id == models.OutcomeType.id)
                .filter(Outcome.is_deleted.is_(False)))
    outcomes = scope.apply(outcomes, Outcome, Outcome.occurred_on).group_by(
        models.OutcomeType.code, models.OutcomeType.name_th, models.OutcomeType.sort_order).order_by(
        models.OutcomeType.sort_order)

    feedback = scope.apply(db.query(Feedback), Feedback, Feedback.date)
    by_rating = (feedback.filter(Feedback.rating.isnot(None))
                 .with_entities(Feedback.rating, func.count(Feedback.id)).group_by(Feedback.rating).order_by(Feedback.rating))
    by_feedback_status = feedback.with_entities(Feedback.status, func.count(Feedback.id)).group_by(Feedback.status)
    average = feedback.with_entities(func.avg(Feedback.rating)).scalar()

    return {
        "filters": {"dateFrom": date_from, "dateTo": date_to, "stakeholderType": stakeholder_type},
        "expiringWithinDays": EXPIRING_WITHIN_DAYS,
        "partnersByType": _keyed(partners),
        "agreementsByStatus": _keyed(by_status),
        "agreementsExpiring": [
            {"id": doc_id, "name": name, "expiryDate": expiry, "partnerId": partner_id, "partnerName": partner_name}
            for doc_id, name, expiry, partner_id, partner_name in expiring
        ],
        "activitiesByMonth": [{"month": m, "count": count} for m, count in activities],
        "outcomesByType": [
            {"key": code, "label": label, "count": count, "totalValue": float(total)}
            for code, label, count, total in outcomes
        ],
        "feedbackBySource": _lookup_counts(db, scope, models.FeedbackSource, Feedback.feedback_source_id),
        "feedbackByRespondentType": _lookup_counts(db, scope, models.RespondentType, Feedback.respondent_type_id),
        "feedbackByRating": _keyed(by_rating),
        "feedbackByStatus": _keyed(by_feedback_status),
        "feedbackAverageRating": round(float(average), 2) if average is not None else None,
    }
