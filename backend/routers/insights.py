"""V4-5 (#90): summary figures for reports and dashboards, aggregated in SQL."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

import database
import models
from auth import require_role
from routers.exports import _csv_response

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
            partner_id = model.partner_id
            if model in (models.Outcome, models.Feedback):
                # Often linked only to an activity; that activity's partner then counts.
                via = aliased(models.Activity)
                query = query.outerjoin(via, model.activity_id == via.id)
                partner_id = func.coalesce(model.partner_id, via.partner_id)
            query = query.join(models.Partner, partner_id == models.Partner.id).filter(
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

    agreement_counts = (scope.apply(db.query(Document.partner_id.label("pid"), func.count(Document.id).label("n")),
                                    Document, Document.effective_date)
                        .filter(Document.doc_type.in_(AGREEMENT_TYPES), Document.is_deleted.is_(False))
                        .group_by(Document.partner_id).subquery())
    activity_counts = (scope.apply(db.query(Activity.partner_id.label("pid"), func.count(Activity.id).label("n")),
                                   Activity, Activity.date)
                       .filter(Activity.is_deleted.is_(False)).group_by(Activity.partner_id).subquery())
    a_count = func.coalesce(agreement_counts.c.n, 0)
    act_count = func.coalesce(activity_counts.c.n, 0)
    top = (db.query(Partner.id, Partner.name, a_count, act_count, (a_count + act_count).label("total"))
           .outerjoin(agreement_counts, agreement_counts.c.pid == Partner.id)
           .outerjoin(activity_counts, activity_counts.c.pid == Partner.id)
           .filter(Partner.is_deleted.is_(False), (a_count + act_count) > 0)
           .order_by((a_count + act_count).desc(), Partner.name).limit(5))

    effective_year = func.extract("year", Document.effective_date)
    by_year = (agreements.filter(Document.effective_date.isnot(None))
               .with_entities(effective_year, func.count(Document.id)).group_by(effective_year).order_by(effective_year))

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
        "agreementsByYear": [{"year": int(y), "count": count} for y, count in by_year],
        "topPartners": [
            {"id": pid, "name": name, "agreements": a, "activities": act, "total": total}
            for pid, name, a, act, total in top
        ],
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


@router.get("/summary.csv")
def summary_csv(
    year: int | None = Query(None, ge=1900, le=2999),
    date_from: date | None = None,
    date_to: date | None = None,
    stakeholder_type: str | None = None,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(require_role("staff", "admin")),
):
    """The summary as one CSV row per figure, with the same filters."""
    data = summary(year, date_from, date_to, stakeholder_type, db, user)
    rows = [("หน่วยงานตามประเภท", r["key"], r["key"], r["count"], "") for r in data["partnersByType"]]
    rows += [("ข้อตกลงตามสถานะ", r["key"], r["key"], r["count"], "") for r in data["agreementsByStatus"]]
    rows += [("ข้อตกลงใกล้หมดอายุ", r["id"], r["name"], 1, r["expiryDate"]) for r in data["agreementsExpiring"]]
    rows += [("กิจกรรมรายเดือน", r["month"], r["month"], r["count"], "") for r in data["activitiesByMonth"]]
    rows += [("ผลลัพธ์ตามประเภท", r["key"], r["label"], r["count"], r["totalValue"]) for r in data["outcomesByType"]]
    rows += [("Feedback ตามแหล่ง", r["key"], r["label"], r["count"], "") for r in data["feedbackBySource"]]
    rows += [("Feedback ตามประเภทผู้ส่ง", r["key"], r["label"], r["count"], "") for r in data["feedbackByRespondentType"]]
    rows += [("Feedback ตามคะแนน", r["key"], r["key"], r["count"], "") for r in data["feedbackByRating"]]
    rows += [("Feedback ตามสถานะ", r["key"], r["key"], r["count"], "") for r in data["feedbackByStatus"]]
    period = f"{data['filters']['dateFrom'] or 'all'}_{data['filters']['dateTo'] or 'all'}"
    return _csv_response(f"insights-summary_{period}.csv", ("หมวด", "รหัส", "รายการ", "จำนวน", "มูลค่ารวม"), rows)


@router.get("/partners/{partner_id}")
def partner_timeline(
    partner_id: int,
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(require_role("staff", "admin")),
):
    """Continuity of one partner: agreements, activities, outcomes and feedback per year."""
    partner = db.query(models.Partner).filter_by(id=partner_id, is_deleted=False).first()
    if partner is None:
        raise HTTPException(status_code=404, detail="Partner not found")

    kinds = {
        "agreements": (models.Document, models.Document.effective_date,
                       [models.Document.doc_type.in_(AGREEMENT_TYPES), models.Document.is_deleted.is_(False)]),
        "activities": (models.Activity, models.Activity.date, [models.Activity.is_deleted.is_(False)]),
        "outcomes": (models.Outcome, models.Outcome.occurred_on, [models.Outcome.is_deleted.is_(False)]),
        "feedback": (models.Feedback, models.Feedback.date, []),
    }
    years: dict[int, dict] = {}
    totals = {}
    for kind, (model, date_column, conditions) in kinds.items():
        year = func.extract("year", date_column)
        rows = (db.query(year, func.count(model.id))
                .filter(model.partner_id == partner_id, date_column.isnot(None), *conditions)
                .group_by(year).all())
        for row_year, count in rows:
            years.setdefault(int(row_year), dict.fromkeys(kinds, 0))[kind] = count
        totals[kind] = (db.query(func.count(model.id))
                        .filter(model.partner_id == partner_id, *conditions).scalar())

    return {
        "partner": {"id": partner.id, "name": partner.name, "type": partner.type},
        "timeline": [{"year": y, **years[y]} for y in sorted(years)],
        "totals": totals,
    }


@router.get("/me")
def my_figures(
    db: Session = Depends(database.get_db),
    user: models.User = Depends(require_role("coordinator", "student")),
):
    """Dashboard figures limited to the signed-in coordinator's or student's own records."""
    if user.role == "student":
        exchange = (db.query(models.ExchangeStudent).filter(models.ExchangeStudent.user_id == user.id)
                    .order_by(models.ExchangeStudent.start_date.desc(), models.ExchangeStudent.id.desc()).all())
        submitted = db.query(func.count(models.Feedback.id)).filter(
            models.Feedback.submitted_by_user_id == user.id).scalar()
        return {
            "role": "student",
            "counts": {"feedbackSubmitted": submitted},
            "exchange": [
                {"id": e.id, "name": e.name, "program": e.program, "status": e.status,
                 "toOrganization": e.to_organization, "startDate": e.start_date, "endDate": e.end_date}
                for e in exchange
            ],
        }

    Partner, Activity, Feedback = models.Partner, models.Activity, models.Feedback
    my_partners = db.query(Partner.id).filter(Partner.owner_user_id == user.id, Partner.is_deleted.is_(False))
    my_activities = db.query(Activity.id).filter(Activity.owner_user_id == user.id, Activity.is_deleted.is_(False))
    feedback = db.query(Feedback).filter(
        (Feedback.partner_id.in_(my_partners)) | (Feedback.activity_id.in_(my_activities)))
    recent = (db.query(Activity).filter(Activity.owner_user_id == user.id, Activity.is_deleted.is_(False))
              .order_by(Activity.date.desc().nullslast(), Activity.id.desc()).limit(5).all())
    return {
        "role": "coordinator",
        "counts": {
            "partners": my_partners.count(),
            "activities": my_activities.count(),
            "outcomes": db.query(func.count(models.Outcome.id)).filter(
                models.Outcome.owner_user_id == user.id, models.Outcome.is_deleted.is_(False)).scalar(),
            "feedback": feedback.count(),
            "feedbackPending": feedback.filter(Feedback.status == "pending").count(),
        },
        "recentActivities": [
            {"id": a.id, "name": a.name, "date": a.date, "status": a.status, "partnerId": a.partner_id}
            for a in recent
        ],
    }


@router.get("/activities/{activity_id}.csv")
def activity_report_csv(
    activity_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(require_role("coordinator", "staff", "admin")),
):
    """"ออกรายงาน" for one activity: the activity, its outcomes and its feedback.
    Coordinators may export only activities they own."""
    activity = db.query(models.Activity).filter_by(id=activity_id, is_deleted=False).first()
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    if user.role == "coordinator" and activity.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your activity")

    outcomes = (db.query(models.Outcome).join(models.OutcomeType)
                .filter(models.Outcome.activity_id == activity_id, models.Outcome.is_deleted.is_(False))
                .order_by(models.Outcome.occurred_on, models.Outcome.id).all())
    feedback = (db.query(models.Feedback).filter(models.Feedback.activity_id == activity_id)
                .order_by(models.Feedback.date, models.Feedback.id).all())
    rows = [("กิจกรรม", activity.name, activity.date, "", "", activity.status, "")]
    rows += [("ผลลัพธ์", o.title, o.occurred_on, o.value, o.unit or o.outcome_type.unit, "", o.description)
             for o in outcomes]
    rows += [("Feedback", f.title, f.date, f.rating, "คะแนน" if f.rating is not None else "", f.status, f.comment)
             for f in feedback]
    return _csv_response(f"activity-{activity_id}-report.csv",
                         ("หมวด", "รายการ", "วันที่", "ค่า", "หน่วย", "สถานะ", "หมายเหตุ"), rows)
