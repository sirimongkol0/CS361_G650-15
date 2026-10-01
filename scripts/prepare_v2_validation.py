"""Prepare a disposable V2 end-to-end database using V2 migration and seed.

Only *_test PostgreSQL databases or *_test.db SQLite files are accepted.
No application or shared database is read or written. Run from repository root.
"""
import hashlib
import json
import os
import platform
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def main():
    from sqlalchemy import inspect, text
    from sqlalchemy.engine import make_url
    url = make_url(os.environ.get('DATABASE_URL', ''))
    if url.get_backend_name() == 'postgresql':
        safe = (url.database or '').endswith('_test')
    elif url.get_backend_name() == 'sqlite':
        safe = (url.database or '').endswith('_test.db')
    else:
        safe = False
    if not safe:
        raise SystemExit('DATABASE_URL must identify a disposable *_test database or *_test.db file')
    report_dir = Path(os.environ.get('TEST_REPORT_DIR', ROOT / '.tmp-v2-6')).resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    storage_dir = report_dir / 'storage'
    os.environ['STORAGE_BACKEND'] = 'local'
    os.environ['LOCAL_STORAGE_DIR'] = str(storage_dir)
    from database import Base, SessionLocal, engine
    from migrate_v2 import migrate
    import models
    import seed_mock
    import storage

    migrate(engine)
    migrate(engine)
    # Existing seed also includes V1 auxiliary tables outside the V2 core migration.
    Base.metadata.create_all(bind=engine)
    sample = (ROOT / 'backend/fixtures/v2-sample.pdf').read_bytes()
    def source(label):
        return models.Source(source_url=f'https://pcsms-demo.example.test/v2-6/{label}',
            source_title='Synthetic V2-6 test evidence, not an official source',
            source_type='demo_fixture', verification_status='verified',
            source_checked_at=datetime(2026, 10, 1, tzinfo=timezone.utc))
    with SessionLocal() as db:
        seed_mock.seed(db)
        counts_before = [db.query(m).count() for m in (models.Partner, models.Document, models.Activity)]
        ids_before = [[row.id for row in db.query(m).order_by(m.id)] for m in (models.Partner, models.Document, models.Activity)]
        seed_mock.seed(db)
        assert ids_before == [[row.id for row in db.query(m).order_by(m.id)] for m in (models.Partner, models.Document, models.Activity)]
        assert counts_before == [db.query(m).count() for m in (models.Partner, models.Document, models.Activity)]
        primary = db.query(models.Partner).filter_by(name=seed_mock.PARTNERS[0]['name']).one()
        if not db.query(models.Partner).filter_by(name='V2-6 Empty Stakeholder').first():
            empty = models.Partner(name='V2-6 Empty Stakeholder', type='government', country='ญี่ปุ่น',
                country_code='JP', description='Synthetic empty relationship fixture',
                website_url='https://pcsms-demo.example.test/v2-6/empty', is_published=True,
                sources=[source('empty-partner')])
            hidden = models.Partner(name='V2-6 Unpublished Stakeholder', type='university', country='ไทย',
                country_code='TH', description='Synthetic private fixture',
                website_url='https://pcsms-demo.example.test/v2-6/hidden', is_published=False,
                sources=[source('hidden-partner')])
            draft_doc = models.Document(name='V2-6 Unpublished Agreement', partner=hidden,
                doc_type='mou', document_kind='agreement', file_availability='available',
                storage_key='v2-6/hidden.pdf', file_name='hidden.pdf', mime_type='application/pdf',
                size_bytes=len(sample), is_published=False, sources=[source('hidden-doc')])
            missing = models.Document(name='V2-6 Missing File Agreement', partner=primary,
                doc_type='mou', document_kind='agreement', status='active',
                effective_date=date(2026, 1, 1), expiry_date=date(2027, 12, 31),
                file_availability='available', storage_key='v2-6/missing.pdf',
                file_name='ตัวอย่าง V2-6.pdf', mime_type='application/pdf', size_bytes=len(sample),
                is_published=True, sources=[source('missing-doc')])
            metadata = models.Document(name='V2-6 Metadata Only Agreement', partner=primary,
                doc_type='moa', document_kind='agreement', file_availability='metadata_only',
                is_published=True, sources=[source('metadata-doc')])
            hidden_activity = models.Activity(name='V2-6 Unpublished Activity', partner=primary,
                mou_document=draft_doc, date=date(2026, 10, 1), is_published=False)
            hidden_targets = models.Activity(name='V2-6 Public Activity Private Targets', partner=hidden,
                mou_document=draft_doc, date=date(2026, 10, 1), date_kind='event', date_precision='day',
                activity_type='อบรม', status='วางแผน', is_published=True, sources=[source('public-activity')])
            db.add_all([empty, hidden, draft_doc, missing, metadata, hidden_activity, hidden_targets])
            db.commit()
        storage.put_file('v2-6/hidden.pdf', sample)
        # Missing-file fixture starts absent on every run; only this reserved fixture is removed.
        storage.delete_file('v2-6/missing.pdf')
        partners = db.query(models.Partner).order_by(models.Partner.id).all()
        documents = db.query(models.Document).order_by(models.Document.id).all()
        activities = db.query(models.Activity).order_by(models.Activity.id).all()
        public_partner_ids = {p.id for p in partners if p.is_published}
        public_document_ids = {d.id for d in documents if d.is_published}
        assert all(d.partner_id is None or any(p.id == d.partner_id for p in partners) for d in documents)
        assert all(a.partner_id is None or any(p.id == a.partner_id for p in partners) for a in activities)
        assert all(a.mou_document_id is None or any(d.id == a.mou_document_id for d in documents) for a in activities)
        foreign_keys = {table: inspect(engine).get_foreign_keys(table) for table in ('documents', 'activities')}
        def named(items, name):
            return next(item for item in items if item.name == name)
        primary_doc = named(documents, seed_mock.DOCUMENTS[0]['name'])
        primary_activity = next(a for a in activities if a.mou_document_id == primary_doc.id)
        missing_doc = named(documents, 'V2-6 Missing File Agreement')
        manifest = {
            'databaseEngine': engine.dialect.name,
            'databaseVersion': db.execute(text('SELECT version()')).scalar() if engine.dialect.name == 'postgresql' else db.execute(text('SELECT sqlite_version()')).scalar(),
            'pythonVersion': platform.python_version(),
            'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'preparedAt': datetime.now(timezone.utc).isoformat(),
            'migrationRuns': 2, 'seedRuns': 2, 'seedCounts': counts_before,
            'foreignKeys': foreign_keys,
            'sampleSha256': hashlib.sha256(sample).hexdigest(),
            'sampleFile': str(ROOT / 'backend/fixtures/v2-sample.pdf'),
            'storageDirectory': str(storage_dir), 'missingStorageKey': missing_doc.storage_key,
            'partners': [{'id':p.id,'name':p.name,'type':p.type,'country':p.country,'published':p.is_published} for p in partners],
            'documents': [{'id':d.id,'name':d.name,'partnerId':d.partner_id if d.partner_id in public_partner_ids else None,
                'published':d.is_published,'type':d.doc_type,'status':d.status,'storageKey':d.storage_key,
                'fileName':d.file_name,'sizeBytes':d.size_bytes,
                'effectiveDate':str(d.effective_date) if d.effective_date else None,
                'expiryDate':str(d.expiry_date) if d.expiry_date else None} for d in documents],
            'activities': [{'id':a.id,'name':a.name,'partnerId':a.partner_id if a.partner_id in public_partner_ids else None,
                'documentId':a.mou_document_id if a.mou_document_id in public_document_ids else None,
                'published':a.is_published,'type':a.activity_type,'status':a.status,
                'date':str(a.date),'endDate':str(a.end_date) if a.end_date else None} for a in activities],
            'selection': {'partner':primary.id,'document':primary_doc.id,'activity':primary_activity.id,
                'emptyPartner':named(partners,'V2-6 Empty Stakeholder').id,
                'hiddenPartner':named(partners,'V2-6 Unpublished Stakeholder').id,
                'hiddenDocument':named(documents,'V2-6 Unpublished Agreement').id,
                'hiddenActivity':named(activities,'V2-6 Unpublished Activity').id,
                'privateTargetsActivity':named(activities,'V2-6 Public Activity Private Targets').id,
                'missingDocument':missing_doc.id,'metadataDocument':named(documents,'V2-6 Metadata Only Agreement').id,
                'noAgreementActivity':next(a.id for a in activities if a.is_published and a.mou_document_id is None)},
        }
    (report_dir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    print(json.dumps({'status':'prepared','database':engine.dialect.name,'seedCounts':counts_before,'reportDirectory':str(report_dir)}, indent=2))


if __name__ == '__main__':
    main()
