from datetime import datetime, timezone

import models


def make_partner(name, **values):
    defaults = dict(type="university", country="Thailand", country_code="TH",
                    description="Partnership description", website_url="https://example.test",
                    is_published=True, contact_name="Coordinator", contact_email="contact@example.test",
                    sources=[models.Source(source_url=f"https://example.test/{name}",
                             source_type="official_page", verification_status="verified",
                             source_checked_at=datetime.now(timezone.utc))])
    defaults.update(values)
    return models.Partner(name=name, **defaults)


def test_list_detail_refresh_and_explicit_contact_permission(client, db_session):
    private = make_partner("Private-contact")
    approved = make_partner("Approved-contact", type="government", country="Japan",
                            country_code="JP", contact_is_public=True)
    draft = make_partner("Draft", is_published=False, contact_is_public=True)
    db_session.add_all([private, approved, draft])
    db_session.commit()
    rows = client.get("/api/v1/partners/").json()
    assert {row["id"] for row in rows} == {private.id, approved.id}
    for row in rows:
        assert client.get(f"/api/v1/partners/{row['id']}").json() == row
    assert rows == client.get("/api/v1/partners/").json()
    private_row = client.get(f"/api/v1/partners/{private.id}").json()
    assert private_row["contactName"] is None and private_row["contactEmail"] is None
    approved_row = client.get(f"/api/v1/partners/{approved.id}").json()
    assert approved_row["contactName"] == "Coordinator"
    assert approved_row["contactEmail"] == "contact@example.test"
    assert client.get(f"/api/v1/partners/{draft.id}").status_code == 404
    assert client.get("/api/v1/partners/999999").status_code == 404


def test_refresh_reads_changed_metadata_and_revoked_permission(client, db_session):
    partner = make_partner("Refresh", contact_is_public=True)
    db_session.add(partner)
    db_session.commit()
    assert client.get(f"/api/v1/partners/{partner.id}").json()["contactEmail"]
    partner.description = "Updated in database"
    partner.contact_is_public = False
    db_session.commit()
    row = client.get(f"/api/v1/partners/{partner.id}").json()
    assert row["description"] == "Updated in database"
    assert row["contactEmail"] is None
    assert client.get("/api/v1/partners/").json() == [row]


def test_pending_source_does_not_publish_partner(client, db_session):
    partner = make_partner("Pending")
    partner.sources[0].verification_status = "pending"
    db_session.add(partner)
    db_session.commit()
    assert client.get("/api/v1/partners/").json() == []
    assert client.get(f"/api/v1/partners/{partner.id}").status_code == 404
