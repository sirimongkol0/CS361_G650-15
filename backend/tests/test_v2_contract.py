"""V2 schema, seed and public contract checks on SQLite or TEST_DATABASE_URL."""

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

import models
import seed_mock
import storage
from database import Base, engine
from migrate_v2 import migrate, CORE_TABLES


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


def test_seed_twice_downloads_pdfs_and_resolves_relationships(db_session, client):
    seed_mock.seed(db_session)
    before = {d.id: (d.storage_key, d.uploaded_at) for d in db_session.query(models.Document)}
    seed_mock.seed(db_session)
    assert before == {d.id: (d.storage_key, d.uploaded_at) for d in db_session.query(models.Document)}
    assert len({p.type for p in db_session.query(models.Partner)}) > 1
    assert len({a.date for a in db_session.query(models.Activity)}) > 1
    docs = client.get('/api/v1/documents/')
    assert docs.status_code == 200
    assert len(docs.json()) == len(seed_mock.DOCUMENTS)
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
    public = models.Document(name='Public agreement', partner=partner, is_published=True)
    draft.scope_items.append(models.DocumentScopeItem(position=0, text='Private scope'))
    activity = models.Activity(name='Published activity', is_published=True,
                               partner=partner, mou_document=draft)
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


def test_metadata_only_document_can_be_read_and_deleted(db_session, client):
    document = models.Document(name='No attachment', is_published=True)
    db_session.add(document)
    db_session.commit()
    doc_id = document.id
    assert client.get('/api/v1/documents/').status_code == 200
    assert client.get(f'/api/v1/documents/{doc_id}/download').status_code == 404
    assert client.delete(f'/api/v1/documents/{doc_id}').status_code == 204
