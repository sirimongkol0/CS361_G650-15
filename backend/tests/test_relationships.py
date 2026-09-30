"""V2-5 public relationship integration tests using real foreign keys."""
from datetime import date, datetime, timezone

import models
import pytest


def source(label):
    return models.Source(source_url=f"https://official.example.test/{label}",
        source_type="official_page", source_checked_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
        verification_status="verified")


def partner(label):
    return models.Partner(name=label, type="university", description="Description",
        website_url="https://official.example.test/partner", country_code="TH",
        is_published=True, sources=[source(label)])


def agreement(label, owner):
    return models.Document(name=label, partner=owner, document_kind="agreement",
        file_availability="metadata_only", is_published=True, sources=[source(label)])


def activity(label, owner, document):
    return models.Activity(name=label, partner=owner, mou_document=document,
        date=date(2026, 10, 1), date_kind="event", date_precision="day",
        is_published=True, sources=[source(label)])


def test_relationship_ids_connect_only_their_database_records(client, db_session):
    first, second = partner("first"), partner("second")
    doc_a, doc_b = agreement("agreement-a", first), agreement("agreement-b", second)
    event_a, event_b = activity("event-a", first, doc_a), activity("event-b", second, doc_b)
    empty = partner("empty")
    no_agreement = activity("no-agreement", first, None)
    db_session.add_all([event_a, event_b, empty, no_agreement])
    db_session.commit()

    docs = client.get("/api/v1/documents/").json()
    events = client.get("/api/v1/activities/").json()
    assert [d["id"] for d in docs if d["partnerId"] == first.id] == [doc_a.id]
    assert {a["id"] for a in events if a["partner"] and a["partner"]["id"] == first.id} == {event_a.id, no_agreement.id}
    assert [a["id"] for a in events if a["mouDocId"] == doc_a.id] == [event_a.id]
    assert not [d for d in docs if d["partnerId"] == empty.id]
    assert not [a for a in events if a["partner"] and a["partner"]["id"] == empty.id]
    detail = client.get(f"/api/v1/activities/{event_a.id}").json()
    assert detail["partner"]["id"] == first.id
    assert detail["mouDocId"] == doc_a.id
    assert client.get(f"/api/v1/partners/{first.id}").json()["id"] == first.id
    assert client.get(f"/api/v1/activities/{no_agreement.id}").json()["mouDocId"] is None


@pytest.mark.parametrize("hidden", ["draft", "pending", "incomplete"])
def test_relationships_cannot_expose_ineligible_targets(client, db_session, hidden):
    owner = partner("hidden-owner")
    doc = agreement("hidden-doc", owner)
    event = activity("visible-event", owner, doc)
    if hidden == "draft":
        owner.is_published = doc.is_published = False
    elif hidden == "pending":
        owner.sources[0].verification_status = doc.sources[0].verification_status = "pending"
    else:
        owner.country_code = None
        doc.document_kind = None
    db_session.add(event)
    db_session.commit()
    assert client.get("/api/v1/partners/").json() == []
    assert client.get("/api/v1/documents/").json() == []
    assert client.get(f"/api/v1/partners/{owner.id}").status_code == 404
    for body in [client.get("/api/v1/activities/").json()[0],
                 client.get(f"/api/v1/activities/{event.id}").json()]:
        assert body["partner"] is None
        assert body["mouDocId"] is None


def test_document_does_not_link_to_unverified_partner(client, db_session):
    owner = partner("unverified-owner")
    owner.sources[0].verification_status = "pending"
    doc = agreement("visible-agreement", owner)
    db_session.add(doc)
    db_session.commit()
    body = client.get("/api/v1/documents/").json()[0]
    assert body["id"] == doc.id
    assert body["partnerId"] is None
