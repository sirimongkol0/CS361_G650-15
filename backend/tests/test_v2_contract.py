"""V2 schema and public contract checks on SQLite or TEST_DATABASE_URL."""

import pytest
from datetime import date, datetime, timezone
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

import models
import storage
from tests import sample_data
from database import Base, engine
from migrate_v2 import migrate, CORE_TABLES


def verified_source(suffix="fixture"):
    return models.Source(
        source_url=f"https://official.example.test/{suffix}",
        source_title="Verified test source",
        source_publisher="Fixture",
        source_type="official_page",
        source_checked_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
        verification_status="verified",
    )


def test_fresh_migration_creates_core_schema_and_repeats():
    Base.metadata.drop_all(engine)
    migrate(engine)
    migrate(engine)
    inspector = inspect(engine)
    assert set(inspector.get_table_names()) == set(CORE_TABLES)
    for name in CORE_TABLES:
        columns = inspector.get_columns(name)
        assert {c['name'] for c in columns} == set(Base.metadata.tables[name].columns.keys())
        assert {c['name']: c['nullable'] for c in columns} == {
            c.name: c.nullable for c in Base.metadata.tables[name].columns
        }
    with engine.begin() as c:
        c.execute(text("INSERT INTO activities (name) VALUES ('No agreement or date')"))
        row = c.execute(text('SELECT is_published, mou_document_id, date FROM activities')).one()
        assert tuple(row) == (False, None, None)


def test_sample_data_downloads_pdfs_and_resolves_relationships(db_session, client):
    sample_data.add_sample_data(db_session)
    assert len({p.type for p in db_session.query(models.Partner)}) > 1
    assert len({a.date for a in db_session.query(models.Activity)}) > 1
    docs = client.get('/api/v1/documents/')
    assert docs.status_code == 200
    assert len(docs.json()) == len(sample_data.DOCUMENTS)
    for doc in docs.json():
        download = client.get(f"/api/v1/documents/{doc['id']}/download")
        assert download.status_code == 200
        assert download.content.startswith(b'%PDF-')
        assert download.content == storage.get_file(doc['storageKey'])
        assert doc['sizeBytes'] == len(download.content)
        assert doc['fileName'] and doc['uploadedAt']
        assert 'timelineSteps' not in doc
    assert any(d['scopeItems'] for d in docs.json())
    activities = client.get('/api/v1/activities/').json()
    assert any(a['mouDocId'] is not None for a in activities)
    assert any(a['mouDocId'] is None for a in activities)
    doc_ids = {d['id'] for d in docs.json()}
    assert all(a['mouDocId'] in doc_ids for a in activities if a['mouDocId'] is not None)


def test_draft_links_and_scope_are_not_exposed(db_session, client):
    partner = models.Partner(name='Draft partner')
    draft = models.Document(name='Draft agreement', partner=partner)
    source = verified_source("draft-links")
    public = models.Document(
        name='Public agreement', partner=partner, is_published=True,
        document_kind="agreement", file_availability="metadata_only", sources=[source],
    )
    draft.scope_items.append(models.DocumentScopeItem(position=0, text='Private scope'))
    activity = models.Activity(name='Published activity', is_published=True,
                               partner=partner, mou_document=draft, date=date(2026, 9, 27),
                               date_kind="event", date_precision="day", sources=[source])
    db_session.add_all([draft, public, activity])
    db_session.commit()
    docs = client.get('/api/v1/documents/').json()
    assert [d['id'] for d in docs] == [public.id]
    assert docs[0]['partnerId'] is None
    assert docs[0]['scopeItems'] == []
    assert client.get(f'/api/v1/documents/{draft.id}/download').status_code == 404
    for response in (client.get('/api/v1/activities/'),
                     client.get(f'/api/v1/activities/{activity.id}')):
        assert response.status_code == 200
        data = response.json()
        row = data[0] if isinstance(data, list) else data
        assert row['partner'] is None and row['mouDocId'] is None


def test_foreign_keys_and_delete_behaviour(db_session):
    partner = models.Partner(name='Partner')
    document = models.Document(name='Agreement', partner=partner)
    activity = models.Activity(name='Activity', partner=partner, mou_document=document)
    document.scope_items.append(models.DocumentScopeItem(text='Scope'))
    db_session.add_all([partner, document, activity])
    db_session.commit()
    activity_id = activity.id
    with engine.begin() as c:
        c.execute(text('DELETE FROM documents WHERE id=:id'), {'id': document.id})
        assert c.execute(text('SELECT count(*) FROM document_scope_items')).scalar_one() == 0
        assert c.execute(text('SELECT mou_document_id FROM activities WHERE id=:id'),
                         {'id': activity_id}).scalar_one() is None
        c.execute(text('DELETE FROM partners WHERE id=:id'), {'id': partner.id})
        assert c.execute(text('SELECT partner_id FROM activities WHERE id=:id'),
                         {'id': activity_id}).scalar_one() is None
    db_session.add(models.Activity(name='Invalid link', mou_document_id=999999))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_metadata_only_document_can_be_read_but_not_deleted_publicly(db_session, client):
    document = models.Document(
        name='No attachment', is_published=True, document_kind="agreement",
        file_availability="metadata_only", sources=[verified_source("metadata-only")],
    )
    db_session.add(document)
    db_session.commit()
    doc_id = document.id
    assert client.get('/api/v1/documents/').status_code == 200
    assert client.get(f'/api/v1/documents/{doc_id}/download').status_code == 404
    assert client.delete(f'/api/v1/documents/{doc_id}').status_code == 405
    assert db_session.get(models.Document, doc_id) is not None


def test_scope_level_is_exposed_and_filters_every_public_list(db_session, client):
    levels = {"program": "หลักสูตร", "faculty": "คณะ", "university": "มหาวิทยาลัย", None: "ยังไม่จัดระดับ"}
    for level, label in levels.items():
        source = verified_source(f"scope-{level}")
        partner = models.Partner(
            name=f"Partner {label}", type="university", description="Fixture", website_url="https://example.test",
            country="Thailand", country_code="TH", is_published=True, scope_level=level, sources=[source],
        )
        db_session.add_all([
            partner,
            models.Document(name=f"Agreement {label}", is_published=True, document_kind="agreement",
                            file_availability="metadata_only", scope_level=level, sources=[source]),
            models.Activity(name=f"Activity {label}", is_published=True, scope_level=level),
        ])
    db_session.commit()
    for path, prefix in (("partners", "Partner"), ("documents", "Agreement"), ("activities", "Activity")):
        everything = client.get(f"/api/v1/{path}/").json()
        assert {row["scopeLevel"] for row in everything} == set(levels)
        for level in ("program", "faculty", "university"):
            rows = client.get(f"/api/v1/{path}/", params={"scope_level": level}).json()
            assert [row["name"] for row in rows] == [f"{prefix} {levels[level]}"]
            assert rows[0]["scopeLevel"] == level
    # The filter combines with the existing filters and with detail routes.
    activity = client.get("/api/v1/activities/", params={"scope_level": "faculty"}).json()[0]
    assert client.get(f"/api/v1/activities/{activity['id']}").json()["scopeLevel"] == "faculty"
    assert client.get("/api/v1/partners/", params={"scope_level": "faculty", "partner_type": "government"}).json() == []


@pytest.mark.parametrize("path", ["partners", "documents", "activities"])
def test_unknown_scope_level_is_rejected(client, path):
    for value in ("department", "PROGRAM"):
        assert client.get(f"/api/v1/{path}/", params={"scope_level": value}).status_code == 422


def test_scope_level_check_constraint_rejects_unknown_values(db_session):
    for factory in (lambda: models.Partner(name="Bad", scope_level="department"),
                    lambda: models.Document(name="Bad", scope_level="department"),
                    lambda: models.Activity(name="Bad", scope_level="department")):
        db_session.add(factory())
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()


def test_scope_level_does_not_change_publication_rules(db_session, client):
    # Level is a label only: an unpublished program-level partner stays hidden.
    db_session.add(models.Partner(name="Hidden program partner", scope_level="program"))
    db_session.commit()
    assert client.get("/api/v1/partners/", params={"scope_level": "program"}).json() == []
