"""scope_level support in scripts/import_cstu_research.py and scripts/backfill_scope_level.py."""

import copy
import json
import sys
from pathlib import Path

import pytest

import models

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import backfill_scope_level as backfill  # noqa: E402
import import_cstu_research as importer  # noqa: E402

DATASETS = sorted((ROOT / "docs" / "research").glob("cstu-*-dataset-*.json")) + sorted(
    (ROOT / "docs" / "research").glob("cstu-candidates-*.json"))


REVIEWED = ROOT / "docs" / "research" / "cstu-reviewed-dataset-2026-10-02.json"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_research_datasets_validate_and_default_to_program_level():
    assert len(DATASETS) >= 2
    for path in DATASETS:
        _, groups = importer.validate(load(path))
        for group in groups.values():
            for _, values in group.values():
                assert values["scope_level"] in {"program", "faculty", "university"}


def test_import_validates_row_scope_level():
    payload = load(REVIEWED)
    explicit = copy.deepcopy(payload)
    explicit["activities"][0]["scope_level"] = "faculty"
    _, groups = importer.validate(explicit)
    assert list(groups["activities"].values())[0][1]["scope_level"] == "faculty"
    assert list(groups["activities"].values())[1][1]["scope_level"] == "program"
    for bad in ("department", None, "Program"):
        broken = copy.deepcopy(payload)
        broken["partners"][0]["scope_level"] = bad
        with pytest.raises(ValueError, match="scope_level"):
            importer.validate(broken)


def test_import_guard_requires_database_name_to_match_everywhere():
    importer.check_target("cstu_collaboration", "cstu_collaboration", "cstu_collaboration")
    importer.check_target("rds_main", "rds_main", "rds_main")
    for args in (("", "cstu_collaboration", "cstu_collaboration"),
                 (None, "cstu_collaboration", "cstu_collaboration"),
                 ("rds_main", "cstu_collaboration", "rds_main"),
                 ("cstu_collaboration", "cstu_collaboration", "rds_main"),
                 ("rds_main", "rds_main", None)):
        with pytest.raises(ValueError):
            importer.check_target(*args)


def test_import_cli_requires_database_name(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["import_cstu_research.py"])
    with pytest.raises(SystemExit) as excinfo:
        importer.main()
    assert excinfo.value.code == 2


def review_file(entries, **overrides):
    return {"schema_version": 1, "target_database": "rds_main", "reviewed": True,
            "entries": entries, **overrides}


def entry(table, row, group="shared_university", level="university", **overrides):
    return {"table": table, "id": row.id, "name": row.name, "is_published": row.is_published,
            "scope_level": level, "group": group, "reason": "ตรวจแล้ว", **overrides}


def test_backfill_exports_only_unclassified_rows(db_session):
    db_session.add_all([
        models.Partner(name="Unclassified partner", is_published=True),
        models.Partner(name="Classified partner", scope_level="program"),
        models.Document(name="Unclassified agreement"),
        models.Activity(name="Unclassified activity"),
    ])
    db_session.commit()
    rows = backfill.export_rows(db_session)
    assert [(r["table"], r["name"], r["is_published"]) for r in rows] == [
        ("partners", "Unclassified partner", True),
        ("documents", "Unclassified agreement", False),
        ("activities", "Unclassified activity", False),
    ]
    assert all(r["scope_level"] is None and r["group"] is None for r in rows)
    # The unreviewed skeleton cannot be applied.
    with pytest.raises(ValueError, match="reviewed"):
        backfill.validate_review({**review_file(rows), "reviewed": False}, "rds_main")


def test_backfill_applies_groups_without_touching_other_rows(db_session):
    shared = models.Document(name="MoU กลาง", is_published=True)
    other = models.Document(name="MoA คณะอื่น", is_published=True)
    untouched = models.Partner(name="ไม่อยู่ในไฟล์", is_published=True)
    already = models.Partner(name="จัดระดับแล้ว", is_published=True, scope_level="program")
    db_session.add_all([shared, other, untouched, already])
    db_session.commit()
    entries = backfill.validate_review(review_file([
        entry("documents", shared),
        entry("documents", other, group="other_faculty"),
        entry("partners", already, level="university"),
    ]), "rds_main")
    report = backfill.apply_review(db_session, entries)
    db_session.commit()
    assert [r["name"] for r in report["updated"]] == ["MoU กลาง", "MoA คณะอื่น"]
    assert [r["name"] for r in report["skipped_already_classified"]] == ["จัดระดับแล้ว"]
    for row in (shared, other, untouched, already):
        db_session.refresh(row)
    assert (shared.scope_level, shared.is_published) == ("university", True)
    assert (other.scope_level, other.is_published) == ("university", False)
    assert (untouched.scope_level, untouched.is_published) == (None, True)
    assert (already.scope_level, already.is_published) == ("program", True)


def test_backfill_rolls_back_cleanly_and_rejects_bad_entries(db_session):
    row = models.Partner(name="Partner", is_published=True)
    db_session.add(row)
    db_session.commit()
    good = entry("partners", row)
    for bad in ({"scope_level": "department"}, {"group": "unknown"}, {"reason": " "},
                {"table": "feedbacks"}, {"extra": 1}):
        with pytest.raises(ValueError):
            backfill.validate_review(review_file([{**good, **bad}]), "rds_main")
    with pytest.raises(ValueError, match="Duplicate"):
        backfill.validate_review(review_file([good, good]), "rds_main")
    with pytest.raises(ValueError, match="target_database"):
        backfill.validate_review(review_file([good], target_database="other"), "rds_main")
    # Renamed row (stale review) and missing row are refused; dry-run rolls back.
    with pytest.raises(ValueError, match="name differs"):
        backfill.apply_review(db_session, [{**good, "name": "Renamed"}])
    with pytest.raises(ValueError, match="not found"):
        backfill.apply_review(db_session, [{**good, "id": 9999}])
    backfill.apply_review(db_session, [good])
    db_session.rollback()
    db_session.refresh(row)
    assert row.scope_level is None
