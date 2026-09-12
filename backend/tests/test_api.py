from fastapi.testclient import TestClient
from datetime import date

from main import app
from database import SessionLocal
import models

client = TestClient(app)


class TestHealth:
    def test_health_check(self):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestPartners:
    def test_list_published_partners_empty(self):
        response = client.get("/api/v1/partners/")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_published_partners_only_published(self):
        db = SessionLocal()
        # Create published partner
        pub_partner = models.Partner(
            name="Published Partner",
            logo_url="https://example.com/logo.png",
            contact_name="Private Coordinator",
            contact_email="private@example.com",
            is_published=True,
        )
        # Create draft partner
        draft_partner = models.Partner(name="Draft Partner", logo_url="https://example.com/draft.png", is_published=False)
        db.add(pub_partner)
        db.add(draft_partner)
        db.commit()
        
        response = client.get("/api/v1/partners/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Published Partner"
        assert data[0]["logoUrl"] == "https://example.com/logo.png"
        assert data[0]["description"] is None
        assert "logo_url" not in data[0]
        assert "is_published" not in data[0]
        assert data[0]["contactName"] == "Private Coordinator"
        assert data[0]["contactEmail"] == "private@example.com"
        db.close()

    def test_get_partner_valid(self):
        db = SessionLocal()
        partner = models.Partner(name="Test Partner", logo_url="https://example.com/test.png", is_published=True)
        db.add(partner)
        db.commit()
        partner_id = partner.id
        db.close()
        
        response = client.get(f"/api/v1/partners/{partner_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Partner"
        assert data["logoUrl"] == "https://example.com/test.png"

    def test_get_partner_with_description(self):
        db = SessionLocal()
        partner = models.Partner(
            name="Test Partner",
            description="A test partner description.",
            logo_url="https://example.com/test.png",
            is_published=True,
        )
        db.add(partner)
        db.commit()
        partner_id = partner.id
        db.close()

        response = client.get(f"/api/v1/partners/{partner_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "A test partner description."

    def test_get_partner_without_description_returns_null(self):
        db = SessionLocal()
        partner = models.Partner(name="No Desc Partner", is_published=True)
        db.add(partner)
        db.commit()
        partner_id = partner.id
        db.close()

        response = client.get(f"/api/v1/partners/{partner_id}")
        assert response.status_code == 200
        assert response.json()["description"] is None

    def test_get_partner_not_found(self):
        response = client.get("/api/v1/partners/9999")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_get_partner_draft_returns_404(self):
        db = SessionLocal()
        draft_partner = models.Partner(name="Draft Partner", logo_url="https://example.com/draft.png", is_published=False)
        db.add(draft_partner)
        db.commit()
        partner_id = draft_partner.id
        db.close()
        
        response = client.get(f"/api/v1/partners/{partner_id}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Partner not found"}


class TestActivities:
    def test_list_published_activities_empty(self):
        response = client.get("/api/v1/activities/")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_published_activities_ordered_by_date_asc(self):
        db = SessionLocal()
        # Create activities with different dates
        activity3 = models.Activity(name="Activity 3", date=date(2024, 1, 15), is_published=True)
        activity1 = models.Activity(name="Activity 1", date=date(2024, 1, 1), is_published=True)
        activity2 = models.Activity(name="Activity 2", date=date(2024, 1, 10), is_published=True)
        db.add(activity3)
        db.add(activity1)
        db.add(activity2)
        db.commit()
        db.close()
        
        response = client.get("/api/v1/activities/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        # Should be ordered by date ascending
        assert data[0]["name"] == "Activity 1"
        assert data[1]["name"] == "Activity 2"
        assert data[2]["name"] == "Activity 3"

    def test_list_published_activities_only_published(self):
        db = SessionLocal()
        pub_activity = models.Activity(name="Published Activity", date=date(2024, 1, 1), is_published=True)
        draft_activity = models.Activity(name="Draft Activity", date=date(2024, 1, 2), is_published=False)
        db.add(pub_activity)
        db.add(draft_activity)
        db.commit()
        db.close()
        
        response = client.get("/api/v1/activities/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Published Activity"

    def test_activity_with_partner(self):
        db = SessionLocal()
        partner = models.Partner(name="Partner for Activity", logo_url="https://example.com/partner.png", is_published=True)
        db.add(partner)
        db.commit()
        partner_id = partner.id  # Save ID before closing
        
        activity = models.Activity(name="Activity with Partner", date=date(2024, 1, 1), is_published=True, partner_id=partner_id)
        db.add(activity)
        db.commit()
        activity_id = activity.id
        db.close()
        
        response = client.get(f"/api/v1/activities/{activity_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Activity with Partner"
        assert data["partner"] is not None
        assert data["partner"]["id"] == partner_id
        assert data["partner"]["name"] == "Partner for Activity"

    def test_activity_does_not_expose_draft_partner(self):
        db = SessionLocal()
        draft_partner = models.Partner(
            name="Draft Partner",
            is_published=False,
        )
        db.add(draft_partner)
        db.flush()
        activity = models.Activity(
            name="Published Activity",
            date=date(2024, 1, 1),
            is_published=True,
            partner_id=draft_partner.id,
        )
        db.add(activity)
        db.commit()
        activity_id = activity.id
        db.close()

        list_response = client.get("/api/v1/activities/")
        detail_response = client.get(f"/api/v1/activities/{activity_id}")

        assert list_response.status_code == 200
        assert list_response.json()[0]["partner"] is None
        assert detail_response.status_code == 200
        assert detail_response.json()["partner"] is None

    def test_activity_without_partner(self):
        db = SessionLocal()
        activity = models.Activity(name="Activity without Partner", date=date(2024, 1, 1), is_published=True, partner_id=None)
        db.add(activity)
        db.commit()
        activity_id = activity.id
        db.close()
        
        response = client.get(f"/api/v1/activities/{activity_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["partner"] is None

    def test_activity_with_description(self):
        db = SessionLocal()
        activity = models.Activity(
            name="Described Activity",
            date=date(2024, 1, 1),
            description="An activity with a full description.",
            is_published=True,
        )
        db.add(activity)
        db.commit()
        activity_id = activity.id
        db.close()

        response = client.get(f"/api/v1/activities/{activity_id}")
        assert response.status_code == 200
        assert response.json()["description"] == "An activity with a full description."

    def test_activity_without_description_returns_null(self):
        db = SessionLocal()
        activity = models.Activity(name="No Desc Activity", date=date(2024, 1, 1), is_published=True)
        db.add(activity)
        db.commit()
        activity_id = activity.id
        db.close()

        response = client.get(f"/api/v1/activities/{activity_id}")
        assert response.status_code == 200
        assert response.json()["description"] is None

    def test_get_activity_not_found(self):
        response = client.get("/api/v1/activities/9999")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_get_activity_draft_returns_404(self):
        db = SessionLocal()
        draft_activity = models.Activity(name="Draft Activity", date=date(2024, 1, 1), is_published=False)
        db.add(draft_activity)
        db.commit()
        activity_id = draft_activity.id
        db.close()
        
        response = client.get(f"/api/v1/activities/{activity_id}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Activity not found"}

    def test_activity_response_uses_contract_aliases(self):
        db = SessionLocal()
        activity = models.Activity(
            name="Aliased Activity",
            date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
            activity_type="workshop",
            is_open=True,
            mou_document_id=None,
            is_published=True,
        )
        db.add(activity)
        db.commit()
        activity_id = activity.id
        db.close()

        data = client.get(f"/api/v1/activities/{activity_id}").json()

        assert data["activity_type"] == "workshop"
        assert data["endDate"] == "2024-01-02"
        assert data["isOpen"] is True
        assert data["mouDocId"] is None
        assert "end_date" not in data
        assert "is_open" not in data
        assert "mou_document_id" not in data

    def test_search_activities_by_name_case_insensitive(self):
        db = SessionLocal()
        db.add_all([
            models.Activity(
                name="International Workshop",
                date=date(2024, 1, 1),
                is_published=True,
            ),
            models.Activity(
                name="Student Exchange",
                date=date(2024, 1, 2),
                is_published=True,
            ),
        ])
        db.commit()
        db.close()

        response = client.get(
            "/api/v1/activities/",
            params={"search": "WORKSHOP"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "International Workshop"


    def test_filter_activities_by_type(self):
        db = SessionLocal()
        db.add_all([
            models.Activity(
                name="Workshop Activity",
                date=date(2024, 1, 1),
                activity_type="workshop",
                is_published=True,
            ),
            models.Activity(
                name="Exchange Activity",
                date=date(2024, 1, 2),
                activity_type="exchange",
                is_published=True,
            ),
        ])
        db.commit()
        db.close()

        response = client.get(
            "/api/v1/activities/",
            params={"activity_type": "workshop"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Workshop Activity"
        assert data[0]["activity_type"] == "workshop"


    def test_filter_activities_by_status(self):
        db = SessionLocal()
        db.add_all([
            models.Activity(
                name="Completed Activity",
                date=date(2024, 1, 1),
                status="เสร็จสิ้น",
                is_published=True,
            ),
            models.Activity(
                name="Planned Activity",
                date=date(2024, 1, 2),
                status="วางแผน",
                is_published=True,
            ),
        ])
        db.commit()
        db.close()

        response = client.get(
            "/api/v1/activities/",
            params={"status": "เสร็จสิ้น"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Completed Activity"
        assert data[0]["status"] == "เสร็จสิ้น"


    def test_filter_activities_by_overlapping_date_range(self):
        db = SessionLocal()
        db.add_all([
            # จบก่อนช่วงที่ค้นหา จึงต้องไม่แสดง
            models.Activity(
                name="Before Range",
                date=date(2024, 1, 1),
                end_date=date(2024, 1, 5),
                is_published=True,
            ),
            # เริ่มก่อน แต่สิ้นสุดอยู่ในช่วงที่ค้นหา จึงต้องแสดง
            models.Activity(
                name="Overlapping Range",
                date=date(2024, 1, 5),
                end_date=date(2024, 1, 15),
                is_published=True,
            ),
            # กิจกรรมวันเดียวที่อยู่ในช่วง จึงต้องแสดง
            models.Activity(
                name="Single Day In Range",
                date=date(2024, 1, 20),
                end_date=None,
                is_published=True,
            ),
            # เริ่มหลังช่วงที่ค้นหา จึงต้องไม่แสดง
            models.Activity(
                name="After Range",
                date=date(2024, 2, 1),
                is_published=True,
            ),
        ])
        db.commit()
        db.close()

        response = client.get(
            "/api/v1/activities/",
            params={
                "date_from": "2024-01-10",
                "date_to": "2024-01-31",
            },
        )

        assert response.status_code == 200
        names = [item["name"] for item in response.json()]

        assert names == [
            "Overlapping Range",
            "Single Day In Range",
        ]


    def test_search_and_filters_work_together_without_exposing_draft(self):
        db = SessionLocal()
        db.add_all([
            # ตรงทุกเงื่อนไขและ Published จึงต้องแสดง
            models.Activity(
                name="Python Workshop",
                date=date(2024, 6, 10),
                activity_type="workshop",
                status="วางแผน",
                is_published=True,
            ),
            # ชื่อตรง แต่ประเภทไม่ตรง
            models.Activity(
                name="Python Exchange",
                date=date(2024, 6, 11),
                activity_type="exchange",
                status="วางแผน",
                is_published=True,
            ),
            # ตรงทุกเงื่อนไขแต่เป็น Draft จึงต้องไม่แสดง
            models.Activity(
                name="Draft Python Workshop",
                date=date(2024, 6, 12),
                activity_type="workshop",
                status="วางแผน",
                is_published=False,
            ),
            # ตรงทุกอย่างยกเว้นช่วงเวลา
            models.Activity(
                name="Old Python Workshop",
                date=date(2023, 6, 10),
                activity_type="workshop",
                status="วางแผน",
                is_published=True,
            ),
        ])
        db.commit()
        db.close()

        response = client.get(
            "/api/v1/activities/",
            params={
                "search": "python",
                "activity_type": "workshop",
                "status": "วางแผน",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Python Workshop"


    def test_search_with_no_result_returns_empty_list(self):
        db = SessionLocal()
        db.add(
            models.Activity(
                name="Existing Activity",
                date=date(2024, 1, 1),
                is_published=True,
            )
        )
        db.commit()
        db.close()

        response = client.get(
            "/api/v1/activities/",
            params={"search": "something-that-does-not-exist"},
        )

        assert response.status_code == 200
        assert response.json() == []


    def test_invalid_filter_date_returns_422(self):
        response = client.get(
            "/api/v1/activities/",
            params={"date_from": "not-a-date"},
        )

        assert response.status_code == 422
        assert "detail" in response.json()


class TestPublicContractErrorsAndCors:
    def test_missing_and_unpublished_use_same_error_shape(self):
        db = SessionLocal()
        draft_partner = models.Partner(name="Draft", is_published=False)
        db.add(draft_partner)
        db.commit()
        draft_id = draft_partner.id
        db.close()

        missing = client.get("/api/v1/partners/9999")
        unpublished = client.get(f"/api/v1/partners/{draft_id}")

        assert missing.status_code == unpublished.status_code == 404
        assert missing.json() == unpublished.json() == {"detail": "Partner not found"}

    def test_invalid_resource_id_uses_error_contract(self):
        response = client.get("/api/v1/activities/not-an-integer")

        assert response.status_code == 422
        assert response.json() == {"detail": "Request validation failed"}

    def test_configured_frontend_origin_is_allowed(self):
        response = client.options(
            "/api/v1/partners/",
            headers={
                "Origin": "http://localhost:3001",
                "Access-Control-Request-Method": "GET",
            },
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:3001"

    def test_unknown_frontend_origin_is_not_allowed(self):
        response = client.options(
            "/api/v1/partners/",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "GET",
            },
        )

        assert response.status_code == 400
        assert "access-control-allow-origin" not in response.headers
