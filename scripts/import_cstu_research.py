"""Import reviewed CSTU public research into the database named by --database-name.

Run inside the backend container with PYTHONPATH=/app and JSON on stdin.
--database-name is required and must equal both current_database() of the
connection and the dataset's target_database, so a dataset cannot be loaded
into the wrong database (local cstu_collaboration or the RDS database).
Default: validate and roll back. --apply: commit one transaction.
Existing records must match exactly (including scope_level); no deletion or
automatic overwrite. Rows without scope_level are imported as 'program'.
"""

import argparse
import json
import sys
from datetime import date, datetime, timezone
from hashlib import sha256
from urllib.parse import urlparse

from sqlalchemy import text

import database
import models


FIELDS = {
    "partners": {
        "name", "type", "country", "country_code", "description", "website_url",
        "scope_level",
    },
    "documents": {
        "name", "doc_type", "document_kind", "file_availability", "effective_date",
        "expiry_date", "responsible", "status", "signer_our", "signer_partner",
        "scope_level",
    },
    "activities": {
        "name", "description", "activity_type", "date", "date_kind", "date_precision",
        "end_date", "time", "location", "participants", "status", "is_open",
        "scope_level",
    },
}
SCOPE_LEVELS = {"program", "faculty", "university"}
DEFAULT_SCOPE_LEVEL = "program"
DATE_FIELDS = {"effective_date", "expiry_date", "date", "end_date"}
SOURCE_FIELDS = {
    "source_url", "source_title", "source_publisher", "source_type",
    "source_checked_at", "source_locator",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def https_url(value):
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username


def check_target(database_name, payload_target, connected_name):
    """Refuse unless the requested, dataset and connected database names all agree."""
    require(isinstance(database_name, str) and database_name.strip(), "--database-name is required")
    require(payload_target == database_name, "Dataset target_database does not match --database-name")
    require(connected_name == database_name, "Connected database mismatch")


def validate(payload):
    require(payload.get("schema_version") == 1, "Unsupported research schema")
    require(isinstance(payload.get("target_database"), str) and payload["target_database"].strip(),
            "Dataset target_database is required")
    require(payload.get("reviewed") is True, "Dataset needs source review")
    require(isinstance(payload.get("sources"), list), "Sources must be an array")
    sources = {}
    for row in payload["sources"]:
        require(set(row) == SOURCE_FIELDS, "Unexpected or missing source fields")
        url = row["source_url"]
        require(https_url(url), "Sources must be HTTPS")
        require(url not in sources, "Duplicate source URL")
        for field in ("source_title", "source_publisher", "source_type", "source_locator"):
            require(isinstance(row[field], str) and row[field].strip(), f"Missing {field}")
        checked = datetime.fromisoformat(row["source_checked_at"].replace("Z", "+00:00"))
        require(checked.tzinfo is not None, "Source check requires a timezone")
        require(checked <= datetime.now(timezone.utc), "Source check cannot be in the future")
        sources[url] = {**row, "source_checked_at": checked}

    groups = {}
    for group, fields in FIELDS.items():
        require(isinstance(payload.get(group), list), f"{group} must be an array")
        groups[group] = {}
        allowed = fields | {"key", "source_urls", "cstu_evidence", "scope_status", "is_published"}
        if group != "partners":
            allowed |= {"partner_key"}
        if group == "documents":
            allowed |= {"scope_items"}
        if group == "activities":
            allowed |= {"agreement_key"}
        for row in payload[group]:
            require(set(row) <= allowed, f"Unexpected {group} field")
            key = row["key"]
            require(isinstance(key, str) and key.isascii() and key.strip(), "Invalid record key")
            require(key not in groups[group], f"Duplicate {group} key")
            require(isinstance(row.get("name"), str) and row["name"].strip(), "Missing name")
            require(bool(row.get("cstu_evidence", "").strip()), "Missing CSTU evidence")
            require(row.get("scope_status") in {"confirmed", "pending"}, "Missing scope review")
            require(isinstance(row.get("is_published"), bool), "Explicit publication decision required")
            require(not row["is_published"] or row["scope_status"] == "confirmed",
                    "Unconfirmed CSTU scope cannot be published")
            urls = row["source_urls"]
            require(isinstance(urls, list) and bool(urls)
                    and all(isinstance(url, str) for url in urls)
                    and len(set(urls)) == len(urls), "Missing/duplicate record citations")
            require(all(url in sources for url in urls), "Unresolved citation")
            values = {field: row.get(field) for field in fields}
            values["scope_level"] = row.get("scope_level", DEFAULT_SCOPE_LEVEL)
            require(values["scope_level"] in SCOPE_LEVELS, "Invalid scope_level")
            for field in DATE_FIELDS & fields:
                if values[field] is not None:
                    values[field] = date.fromisoformat(values[field])
            if group == "partners":
                require(values["type"] in {
                    "university", "government", "private_company", "network", "vocational",
                    "healthcare", "international_organization",
                }, "Unsupported partner type")
                require(bool(values["description"]) and bool(values["country"]), "Incomplete partner")
                require(values["country_code"] and len(values["country_code"]) == 2
                        and values["country_code"].isupper(), "Invalid partner country")
                require(https_url(values["website_url"]), "Partner website must be HTTPS")
            if group == "documents":
                require(values["doc_type"] in {"mou", "moa", "template", "announcement"},
                        "Invalid document type")
                require(values["file_availability"] == "metadata_only",
                        "Research import supports metadata only, not generated contract files")
                require(values["document_kind"] in {
                    "agreement", "template", "procedure", "announcement", "other",
                }, "Invalid document kind")
                require(isinstance(row.get("scope_items", []), list)
                        and all(isinstance(item, str) and item.strip()
                                for item in row.get("scope_items", [])), "Invalid scope item")
                start, end = values["effective_date"], values["expiry_date"]
                require(not start or not end or end >= start, "Reversed agreement period")
                require(values["status"] in {None, "active", "expiring", "expired", "draft"},
                        "Invalid agreement status")
                if values["status"] == "expired":
                    require(end is not None and end < date.today(), "Expired status needs an expired date")
                if values["status"] in {"active", "expiring"}:
                    require(end is not None and end >= date.today(), "Live status needs a current end date")
                    require(start is None or start <= date.today(), "Live agreement has not started")
            if group == "activities":
                require(values["activity_type"] in {
                    "official_event", "collaboration_meeting", "exchange",
                    "student_workshop_competition", "student_activity", "engineering_camp",
                    "seminar", "academic_visit", "international_conference",
                }, "Invalid activity type")
                require(values["date_kind"] in {None, "event", "announcement", "deadline",
                    "application_open", "application_close", "period_start", "period_end"},
                    "Invalid date meaning")
                require(values["date_precision"] in {None, "day", "month", "year", "approximate"},
                        "Invalid date precision")
                require(values["status"] in {None, "วางแผน", "กำลังดำเนินการ", "เสร็จสิ้น"},
                        "Invalid activity status")
                require(values["date"] is None or (values["date_kind"] and values["date_precision"]),
                        "Dated activity requires meaning and precision")
                require(values["date"] is not None or not (values["date_kind"] or values["date_precision"]),
                        "Undated activity cannot have date metadata")
                require(values["is_open"] is None or isinstance(values["is_open"], bool),
                        "Enrollment must be bool or unknown")
                require(values["participants"] is None or (
                    type(values["participants"]) is int and values["participants"] >= 0
                ), "Invalid participant count")
                require(not values["end_date"] or (values["date"]
                        and values["end_date"] >= values["date"]), "Reversed activity period")
            groups[group][key] = (row, values)
    for group in ("documents", "activities"):
        for row, _ in groups[group].values():
            require(not row.get("partner_key") or row["partner_key"] in groups["partners"],
                    "Unresolved partner reference")
            if row["is_published"] and row.get("partner_key"):
                require(groups["partners"][row["partner_key"]][0]["is_published"],
                        "Published record cannot link an unpublished research partner")
            if group == "activities" and row.get("agreement_key"):
                require(row["agreement_key"] in groups["documents"], "Unresolved agreement reference")
                require(groups["documents"][row["agreement_key"]][1]["document_kind"] == "agreement",
                        "Activity link must reference an actual agreement")
                if row["is_published"]:
                    require(groups["documents"][row["agreement_key"]][0]["is_published"],
                            "Published activity cannot link an unconfirmed agreement")
    return sources, groups


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-name", required=True,
                        help="Database this import is allowed to write, e.g. cstu_collaboration")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    raw = sys.stdin.buffer.read()
    payload = json.loads(raw.decode("utf-8-sig"))
    source_data, groups = validate(payload)
    require(database.engine.url.get_backend_name() == "postgresql", "PostgreSQL required")
    require(database.engine.url.database == args.database_name,
            "Refusing to import: --database-name does not match the configured database")
    result = {"applied": args.apply, "database": args.database_name,
              "dataset_sha256": sha256(raw).hexdigest(), "records": {}}
    with database.SessionLocal() as session:
        check_target(args.database_name, payload["target_database"],
                     session.execute(text("SELECT current_database()")).scalar())
        # Serialize concurrent imports of this dataset into this database.
        session.execute(text("SELECT pg_advisory_xact_lock(36120261002)"))
        sources = {}
        for url, values in source_data.items():
            source = session.query(models.Source).filter_by(source_url=url).one_or_none()
            if source is None:
                source = models.Source(**values, verification_status="verified")
                session.add(source)
            else:
                require(source.verification_status == "verified", "Existing source is not verified")
                for field in SOURCE_FIELDS - {"source_checked_at"}:
                    require(getattr(source, field) == values[field], f"Existing source differs: {url}")
            sources[url] = source
        session.flush()
        record_map = {}
        for group, model in (("partners", models.Partner), ("documents", models.Document),
                             ("activities", models.Activity)):
            record_map[group] = {}
            result["records"][group] = []
            for key, (row, field_values) in groups[group].items():
                values = {**field_values, "is_published": row["is_published"]}
                if group == "partners":
                    values["contact_is_public"] = False
                else:
                    partner = record_map["partners"].get(row.get("partner_key"))
                    values["partner_id"] = partner.id if partner else None
                if group == "activities":
                    agreement = record_map["documents"].get(row.get("agreement_key"))
                    values["mou_document_id"] = agreement.id if agreement else None
                existing = session.query(model).filter_by(name=values["name"]).all()
                require(len(existing) <= 1, f"Ambiguous existing {group} record: {key}")
                record = existing[0] if existing else None
                state = "existing" if record else "inserted"
                if record is None:
                    record = model(**values)
                    record.sources = [sources[url] for url in row["source_urls"]]
                    if group == "documents":
                        record.scope_items = [models.DocumentScopeItem(position=i, text=item)
                                              for i, item in enumerate(row.get("scope_items", []))]
                    session.add(record)
                    session.flush()
                else:
                    for field, value in values.items():
                        require(getattr(record, field) == value,
                                f"Existing {group} field differs; review required: {key}/{field}")
                    require({source.source_url for source in record.sources} == set(row["source_urls"]),
                            f"Existing citations differ: {key}")
                    if group == "documents":
                        require([item.text for item in record.scope_items] == row.get("scope_items", []),
                                f"Existing scopes differ: {key}")
                record_map[group][key] = record
                result["records"][group].append({"key": key, "id": record.id, "state": state})
        session.flush()
        if args.apply:
            session.commit()
        else:
            session.rollback()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
