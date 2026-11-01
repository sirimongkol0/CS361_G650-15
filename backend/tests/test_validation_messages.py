"""422 responses keep each field error with a Thai message (issue #105)."""
from tests.test_auth import bearer, cognito, token_for  # noqa: F401


def _errors(response):
    assert response.status_code == 422, response.text
    return {tuple(error["loc"]): error["msg"] for error in response.json()["detail"]}


def test_end_date_before_start_date_is_rejected_in_thai(client, cognito):
    headers = bearer(token_for(client, "staff"))
    body = {"name": "Exchange", "start_date": "2026-09-01", "end_date": "2026-08-01"}
    assert _errors(client.post("/api/v1/exchange/", json=body, headers=headers)) == {
        ("body",): "วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น",
    }
    body = {"name": "Activity", "date": "2026-09-01", "end_date": "2026-08-01"}
    assert _errors(client.post("/api/v1/activities/", json=body, headers=headers)) == {
        ("body",): "วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น",
    }


def test_rating_out_of_range_names_the_field(client, cognito):
    headers = bearer(token_for(client, "student"))
    body = {"title": "t", "respondent_type_id": 1, "rating": 6, "activity_id": 1}
    assert _errors(client.post("/api/v1/feedback/", json=body, headers=headers)) == {
        ("body", "rating"): "ต้องมีค่าไม่เกิน 5",
    }


def test_blank_name_uses_the_schema_message(client, cognito):
    headers = bearer(token_for(client, "staff"))
    assert _errors(client.post("/api/v1/partners/", json={"name": "   "}, headers=headers)) == {
        ("body", "name"): "ชื่อห้ามเป็นช่องว่างเปล่า",
    }
