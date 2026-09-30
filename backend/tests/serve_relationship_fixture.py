"""Serve isolated V2-5 browser fixtures; never uses the application database."""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['STORAGE_BACKEND'] = 'local'
from main import app
from database import SessionLocal
from tests.test_relationships import partner, agreement, activity
import uvicorn
with SessionLocal() as db:
    a, b, empty = partner('Audit Alpha'), partner('Audit Beta'), partner('Audit Empty')
    doc_empty = agreement('Audit Agreement Empty', None)
    doc_a, doc_b = agreement('Audit Agreement Alpha', a), agreement('Audit Agreement Beta', b)
    event_a, event_b = activity('Audit Activity Alpha', a, doc_a), activity('Audit Activity Beta', b, doc_b)
    solo = activity('Audit No Agreement', a, None)
    hidden = agreement('Audit Hidden Agreement', a)
    hidden.is_published = False
    pending = partner('Audit Hidden Partner')
    pending.sources[0].verification_status = 'pending'
    public = activity('Audit Public Hidden Targets', pending, hidden)
    db.add_all([a, b, empty, doc_a, doc_b, doc_empty, event_a, event_b, solo, public])
    db.commit()
    import json
    Path('.tmp-v2-5-ids.json').write_text(json.dumps(dict(alpha=a.id,beta=b.id,empty=empty.id,docAlpha=doc_a.id,docBeta=doc_b.id,docEmpty=doc_empty.id,eventAlpha=event_a.id,eventBeta=event_b.id,solo=solo.id,hiddenEvent=public.id,hiddenDoc=hidden.id,hiddenPartner=pending.id)))
uvicorn.run(app, host='127.0.0.1', port=8125)
