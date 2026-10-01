"""Backfill scope_level on existing rows from a reviewed JSON file.

Run inside the backend container with PYTHONPATH=/app. Two steps:

1. Export (no --review): lists every partner/document/activity whose
   scope_level IS NULL as a review skeleton on stdout. Nothing is written.
   A person fills in scope_level, group and reason for each entry, then sets
   "reviewed": true (docs/research/rds-scope-review-<date>.json).
2. Apply: --review FILE (or - for stdin) validates the reviewed file against the database and
   rolls back; add --apply to commit one transaction.

Groups: shared_university keeps the record published; other_faculty also sets
is_published=false (the record is kept, never deleted). Only listed rows whose
scope_level is still NULL are touched, and the stored name must match the
entry. --database-name is required and must equal current_database().
"""

import argparse
import json
import sys

from sqlalchemy import text, update

import database
import models


TABLES = {"partners": models.Partner, "documents": models.Document, "activities": models.Activity}
SCOPE_LEVELS = {"program", "faculty", "university"}
GROUPS = {"shared_university", "other_faculty"}
ENTRY_FIELDS = {"table", "id", "name", "is_published", "scope_level", "group", "reason"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def export_rows(session):
    """Skeleton of every unclassified row; reviewers fill scope_level/group/reason."""
    entries = []
    for table, model in TABLES.items():
        for row in session.query(model).filter(model.scope_level.is_(None)).order_by(model.id):
            entries.append({
                "table": table, "id": row.id, "name": row.name,
                "is_published": row.is_published,
                "scope_level": None, "group": None, "reason": "",
            })
    return entries


def validate_review(review, database_name):
    require(review.get("schema_version") == 1, "Unsupported review schema")
    require(review.get("target_database") == database_name,
            "Review target_database does not match --database-name")
    require(review.get("reviewed") is True, "Review file has not been marked reviewed")
    entries = review.get("entries")
    require(isinstance(entries, list), "entries must be an array")
    seen = set()
    for entry in entries:
        require(set(entry) <= ENTRY_FIELDS, "Unexpected review entry field")
        require(entry.get("table") in TABLES, "Unknown table in review entry")
        require(type(entry.get("id")) is int, "Review entry needs an integer id")
        require((entry["table"], entry["id"]) not in seen, "Duplicate review entry")
        seen.add((entry["table"], entry["id"]))
        require(entry.get("scope_level") in SCOPE_LEVELS, "Invalid scope_level in review entry")
        require(entry.get("group") in GROUPS, "Invalid group in review entry")
        require(isinstance(entry.get("reason"), str) and entry["reason"].strip(),
                "Review entry needs a reason")
        require(isinstance(entry.get("name"), str) and entry["name"].strip(),
                "Review entry needs the record name")
    return entries


def apply_review(session, entries):
    """Update only listed rows that are still unclassified; returns a per-row report."""
    report = {"updated": [], "skipped_already_classified": []}
    for entry in entries:
        model = TABLES[entry["table"]]
        row = session.get(model, entry["id"])
        require(row is not None, f"{entry['table']} id {entry['id']} not found")
        require(row.name == entry["name"],
                f"{entry['table']} id {entry['id']} name differs from the review file")
        item = {"table": entry["table"], "id": row.id, "name": row.name,
                "scope_level": entry["scope_level"], "group": entry["group"]}
        if row.scope_level is not None:
            report["skipped_already_classified"].append({**item, "current": row.scope_level})
            continue
        values = {"scope_level": entry["scope_level"]}
        item["unpublished"] = entry["group"] == "other_faculty" and bool(row.is_published)
        if entry["group"] == "other_faculty":
            values["is_published"] = False
        # The IS NULL guard keeps this a no-overwrite update even under concurrency.
        result = session.execute(update(model).where(
            model.id == row.id, model.scope_level.is_(None)).values(**values))
        require(result.rowcount == 1, f"{entry['table']} id {entry['id']} changed during backfill")
        report["updated"].append(item)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database-name", required=True,
                        help="Database this backfill is allowed to read/write")
    parser.add_argument("--review", help="Reviewed JSON file or - for stdin; omit to export unclassified rows")
    parser.add_argument("--apply", action="store_true", help="Commit (requires --review)")
    args = parser.parse_args()
    require(not args.apply or args.review, "--apply needs --review")
    require(database.engine.url.get_backend_name() == "postgresql", "PostgreSQL required")
    require(database.engine.url.database == args.database_name,
            "Refusing to run: --database-name does not match the configured database")
    with database.SessionLocal() as session:
        require(session.execute(text("SELECT current_database()")).scalar() == args.database_name,
                "Connected database mismatch")
        if not args.review:
            output = {"schema_version": 1, "target_database": args.database_name, "reviewed": False,
                      "entries": export_rows(session)}
            print(json.dumps(output, ensure_ascii=False, indent=2))
            session.rollback()
            return
        if args.review == "-":
            raw = sys.stdin.buffer.read()
        else:
            with open(args.review, "rb") as handle:
                raw = handle.read()
        review = json.loads(raw.decode("utf-8-sig"))
        entries = validate_review(review, args.database_name)
        session.execute(text("SELECT pg_advisory_xact_lock(36120261003)"))
        report = apply_review(session, entries)
        session.flush()
        if args.apply:
            session.commit()
        else:
            session.rollback()
    print(json.dumps({"applied": args.apply, "database": args.database_name, **report},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        sys.exit(f"Error: {error}")
