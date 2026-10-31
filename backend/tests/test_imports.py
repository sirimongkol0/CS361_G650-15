"""V4-4 import/export API tests. All test rows and identities are synthetic."""

import csv
import io
from datetime import date

import models
import pytest
import storage
from tests.test_auth import bearer, cognito, token_for  # noqa: F401


def _upload_feedback(client, headers, activity_id, external_id="COOP-DEMO-001"):
    csv_text = (
        "external_id,title,respondent_type_code,date,rating,comment,partner_id,activity_id,document_id,exchange_id\n"
        f"{external_id},Synthetic feedback,student,2026-01-15,5,synthetic comment,,{activity_id},,\n"
    )
    return client.post(
        "/api/v1/imports/?kind=feedback",
        headers=headers,
        files={"file": ("synthetic-feedback.csv", csv_text.encode("utf-8-sig"), "text/csv")},
    )


def _upload_outcome(client, headers, activity_id, external_id="SYNTHETIC-OUT-001"):
    csv_text = (
        "external_id,outcome_type_code,title,description,value,unit,occurred_on,evidence_url,partner_id,activity_id,document_id,exchange_id\n"
        f"{external_id},participants,Synthetic outcome,Synthetic description,3,people,2026-01-15,,,{activity_id},,\n"
    )
    return client.post(
        "/api/v1/imports/?kind=outcome",
        headers=headers,
        files={"file": ("synthetic-outcome.csv", csv_text.encode("utf-8-sig"), "text/csv")},
    )


def test_import_api_is_staff_admin_only(client, cognito):
    assert client.get("/api/v1/imports/").status_code == 401
    assert client.get("/api/v1/imports/", headers=bearer(token_for(client, "student"))).status_code == 403
    assert client.get("/api/v1/imports/", headers=bearer(token_for(client, "coordinator"))).status_code == 403
    assert client.get("/api/v1/imports/", headers=bearer(token_for(client, "staff"))).status_code == 200
    assert client.get("/api/v1/imports/", headers=bearer(token_for(client, "admin"))).status_code == 200


def test_feedback_import_preview_commit_and_rollback_are_audited(client, db_session, cognito):
    activity = models.Activity(name="Synthetic workshop", is_published=True)
    db_session.add(activity)
    db_session.commit()
    headers = bearer(token_for(client, "staff"))

    response = _upload_feedback(client, headers, activity.id)
    assert response.status_code == 202, response.text
    batch = response.json()
    # Starlette TestClient runs BackgroundTasks before returning the response.
    preview = client.get(f"/api/v1/imports/{batch['id']}", headers=headers)
    assert preview.status_code == 200, preview.text
    assert preview.json()["status"] == "previewed"
    assert preview.json()["totalRows"] == 1
    assert preview.json()["validRows"] == 1
    assert preview.json()["invalidRows"] == 0
    assert preview.json()["previewData"][0]["external_id"] == "COOP-DEMO-001"

    committed = client.post(f"/api/v1/imports/{batch['id']}/commit", headers=headers)
    assert committed.status_code == 200, committed.text
    imported = db_session.query(models.Feedback).filter_by(external_id="COOP-DEMO-001").one()
    assert imported.import_batch_id == batch["id"]
    assert imported.submitted_by_user_id is None
    assert imported.is_published is False

    # Rollback removes only rows from this import batch, not unrelated feedback.
    respondent = db_session.query(models.RespondentType).filter_by(code="student").one()
    source = db_session.query(models.FeedbackSource).filter_by(code="web_form").one()
    unrelated = models.Feedback(
        title="Unrelated synthetic feedback", activity_id=activity.id,
        respondent_type_id=respondent.id, feedback_source_id=source.id,
        status="pending", is_published=False,
    )
    db_session.add(unrelated)
    db_session.commit()
    unrelated_id = unrelated.id

    rolled_back = client.post(f"/api/v1/imports/{batch['id']}/rollback", headers=headers)
    assert rolled_back.status_code == 200, rolled_back.text
    assert rolled_back.json()["status"] == "rolled_back"
    assert db_session.query(models.Feedback).filter_by(external_id="COOP-DEMO-001").count() == 0
    assert db_session.get(models.Feedback, unrelated_id) is not None

    logs = db_session.query(models.AuditLog).filter_by(entity="import_batches", entity_id=batch["id"]).all()
    assert {log.action for log in logs} == {"commit_import", "rollback_import"}


def test_import_commits_only_valid_rows_and_reimport_is_rejected(client, db_session, cognito):
    activity = models.Activity(name="Synthetic import activity", is_published=True)
    db_session.add(activity)
    db_session.commit()
    headers = bearer(token_for(client, "staff"))
    csv_text = (
        "external_id,title,respondent_type_code,date,rating,comment,partner_id,activity_id,document_id,exchange_id\n"
        f"SYNTHETIC-VALID-ROW,Valid row,student,2026-02-01,5,,,{activity.id},,\n"
        f"SYNTHETIC-INVALID-ROW,Invalid row,unknown,2026-02-01,5,,,{activity.id},,\n"
    )
    response = client.post(
        "/api/v1/imports/?kind=feedback",
        headers=headers,
        files={"file": ("synthetic.csv", csv_text.encode("utf-8-sig"), "text/csv")},
    )
    assert response.status_code == 202, response.text
    batch_id = response.json()["id"]
    preview = client.get(f"/api/v1/imports/{batch_id}", headers=headers).json()
    assert (preview["totalRows"], preview["validRows"], preview["invalidRows"]) == (2, 1, 1)

    committed = client.post(f"/api/v1/imports/{batch_id}/commit", headers=headers)
    assert committed.status_code == 200, committed.text
    assert db_session.query(models.Feedback).filter_by(
        external_id="SYNTHETIC-VALID-ROW"
    ).count() == 1
    assert db_session.query(models.Feedback).filter_by(
        external_id="SYNTHETIC-INVALID-ROW"
    ).count() == 0

    duplicate = _upload_feedback(
        client, headers, activity.id, "SYNTHETIC-VALID-ROW"
    )
    assert duplicate.status_code == 202, duplicate.text
    duplicate_preview = client.get(
        f"/api/v1/imports/{duplicate.json()['id']}", headers=headers
    ).json()
    assert duplicate_preview["validRows"] == 0
    assert duplicate_preview["invalidRows"] == 1
    assert client.post(
        f"/api/v1/imports/{duplicate.json()['id']}/commit", headers=headers
    ).status_code == 409
    assert db_session.query(models.Feedback).filter_by(
        external_id="SYNTHETIC-VALID-ROW"
    ).count() == 1


def test_outcome_import_rejects_reimport_and_rollback_preserves_other_rows(
    client, db_session, cognito
):
    activity = models.Activity(name="Synthetic outcome activity", is_published=True)
    db_session.add(activity)
    db_session.commit()
    headers = bearer(token_for(client, "admin"))

    response = _upload_outcome(client, headers, activity.id)
    assert response.status_code == 202, response.text
    batch_id = response.json()["id"]
    preview = client.get(f"/api/v1/imports/{batch_id}", headers=headers).json()
    assert preview["validRows"] == 1
    assert client.post(
        f"/api/v1/imports/{batch_id}/commit", headers=headers
    ).status_code == 200

    unrelated = models.Outcome(
        title="Unrelated synthetic outcome",
        outcome_type_id=db_session.query(models.OutcomeType).filter_by(
            code="participants"
        ).one().id,
        activity_id=activity.id,
        external_id="SYNTHETIC-OUT-OTHER",
        is_published=False,
        is_deleted=False,
    )
    db_session.add(unrelated)
    db_session.commit()
    unrelated_id = unrelated.id

    duplicate = _upload_outcome(
        client, headers, activity.id, "SYNTHETIC-OUT-001"
    )
    assert duplicate.status_code == 202, duplicate.text
    duplicate_preview = client.get(
        f"/api/v1/imports/{duplicate.json()['id']}", headers=headers
    ).json()
    assert duplicate_preview["validRows"] == 0
    assert duplicate_preview["invalidRows"] == 1
    assert client.post(
        f"/api/v1/imports/{duplicate.json()['id']}/commit", headers=headers
    ).status_code == 409
    assert db_session.query(models.Outcome).filter_by(
        external_id="SYNTHETIC-OUT-001"
    ).count() == 1

    rolled_back = client.post(
        f"/api/v1/imports/{batch_id}/rollback", headers=headers
    )
    assert rolled_back.status_code == 200, rolled_back.text
    assert db_session.query(models.Outcome).filter_by(
        external_id="SYNTHETIC-OUT-001"
    ).count() == 0
    assert db_session.get(models.Outcome, unrelated_id) is not None


def test_duplicate_external_id_is_reported_in_thai_preview(client, db_session, cognito):
    activity = models.Activity(name="Synthetic activity", is_published=True)
    db_session.add(activity)
    db_session.commit()
    respondent = db_session.query(models.RespondentType).filter_by(code="student").one()
    source = db_session.query(models.FeedbackSource).filter_by(code="coop_system").one()
    db_session.add(models.Feedback(
        title="Previously imported", activity_id=activity.id, respondent_type_id=respondent.id,
        feedback_source_id=source.id, external_id="COOP-DUP-1", status="pending", is_published=False,
    ))
    db_session.commit()

    headers = bearer(token_for(client, "admin"))
    response = _upload_feedback(client, headers, activity.id, "COOP-DUP-1")
    assert response.status_code == 202, response.text
    preview = client.get(f"/api/v1/imports/{response.json()['id']}", headers=headers).json()
    assert preview["validRows"] == 0
    assert preview["invalidRows"] == 1
    assert "มีอยู่ในระบบแล้ว" in preview["errors"][0]["message"]
    assert "COOP-DUP-1" not in preview["errors"][0]["message"]
    assert client.post(f"/api/v1/imports/{response.json()['id']}/commit", headers=headers).status_code == 409


def test_csv_preview_preserves_source_row_numbers_and_does_not_echo_input(client, db_session, cognito):
    activity = models.Activity(name="Synthetic activity", is_published=True)
    db_session.add(activity)
    db_session.commit()
    headers = bearer(token_for(client, "staff"))
    csv_text = (
        "external_id,title,respondent_type_code,date,rating,comment,partner_id,activity_id,document_id,exchange_id,student_name,student_email,student_id\n"
        "\n"
        f"SYNTHETIC-VALID-1,Synthetic title,student,2026-01-15,5,synthetic comment,,{activity.id},,,Synthetic Student,synthetic@example.test,SYNTH-123\n"
        f"PRIVATE-STUDENT-123,Another title,unknown-private-code,2026-01-15,5,private comment,,{activity.id},,,Private Student,private@example.test,PRIVATE-123\n"
    )
    response = client.post(
        "/api/v1/imports/?kind=feedback",
        headers=headers,
        files={"file": ("synthetic.csv", csv_text.encode("utf-8-sig"), "text/csv")},
    )
    assert response.status_code == 202, response.text

    preview = client.get(
        f"/api/v1/imports/{response.json()['id']}", headers=headers
    ).json()
    error = preview["errors"][0]
    assert error["row"] == 4
    assert preview["validRows"] == 1
    assert "PRIVATE-STUDENT-123" not in error["message"]
    assert "unknown-private-code" not in error["message"]
    assert "private comment" not in error["message"]
    preview_json = str(preview["previewData"])
    assert "synthetic@example.test" not in preview_json
    assert "SYNTH-123" not in preview_json


def test_xlsx_preview_preserves_source_row_numbers(client, db_session, cognito):
    from io import BytesIO

    from openpyxl import Workbook

    activity = models.Activity(name="Synthetic XLSX activity", is_published=True)
    db_session.add(activity)
    db_session.commit()
    workbook = Workbook()
    sheet = workbook.active
    sheet.append([
        "external_id", "title", "respondent_type_code", "date", "rating",
        "comment", "partner_id", "activity_id", "document_id", "exchange_id",
    ])
    sheet.append([None] * 10)
    sheet.append([
        "SYNTHETIC-XLSX-1", "Synthetic title", "unknown-code", "2026-01-15",
        5, "synthetic comment", None, activity.id, None, None,
    ])
    content = BytesIO()
    workbook.save(content)

    headers = bearer(token_for(client, "staff"))
    response = client.post(
        "/api/v1/imports/?kind=feedback",
        headers=headers,
        files={"file": ("synthetic.xlsx", content.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 202, response.text
    preview = client.get(
        f"/api/v1/imports/{response.json()['id']}", headers=headers
    ).json()
    assert preview["errors"][0]["row"] == 3


def test_import_rejects_overlong_external_id_without_echoing_it(client, db_session, cognito):
    activity = models.Activity(name="Synthetic activity", is_published=True)
    db_session.add(activity)
    db_session.commit()
    external_id = "X" * 256
    headers = bearer(token_for(client, "staff"))
    response = _upload_feedback(client, headers, activity.id, external_id)
    assert response.status_code == 202, response.text

    preview = client.get(
        f"/api/v1/imports/{response.json()['id']}", headers=headers
    ).json()
    assert preview["validRows"] == 0
    assert "external_id ต้องมีความยาวไม่เกิน 255" in preview["errors"][0]["message"]
    assert external_id not in preview["errors"][0]["message"]


def test_csv_exports_are_protected_and_include_template_columns(client, db_session, cognito):
    assert client.get("/api/v1/imports/export/feedback.csv").status_code == 401
    headers = bearer(token_for(client, "staff"))
    response = client.get("/api/v1/imports/templates/feedback?format=csv", headers=headers)
    assert response.status_code == 200
    assert "external_id" in response.content.decode("utf-8-sig")
    export = client.get("/api/v1/imports/export/outcomes.csv", headers=headers)
    assert export.status_code == 200
    assert "outcome_type_code" in export.content.decode("utf-8-sig")


def test_export_endpoints_apply_feedback_and_outcome_filters(client, db_session, cognito):
    first_activity = models.Activity(name="Synthetic export activity 1", is_published=True)
    other_activity = models.Activity(name="Synthetic export activity 2", is_published=True)
    db_session.add_all([first_activity, other_activity])
    db_session.flush()
    student = db_session.query(models.RespondentType).filter_by(code="student").one()
    alumni = db_session.query(models.RespondentType).filter_by(code="alumni").one()
    coop_source = db_session.query(models.FeedbackSource).filter_by(code="coop_system").one()
    web_source = db_session.query(models.FeedbackSource).filter_by(code="web_form").one()
    feedback_rows = [
        models.Feedback(
            title="Matching feedback", external_id="SYNTH-FB-MATCH",
            respondent_type_id=student.id, feedback_source_id=coop_source.id,
            activity_id=first_activity.id, date=date(2026, 2, 10), status="reviewed",
        ),
        models.Feedback(
            title="Wrong status feedback", external_id="SYNTH-FB-STATUS",
            respondent_type_id=student.id, feedback_source_id=coop_source.id,
            activity_id=first_activity.id, date=date(2026, 2, 11), status="pending",
        ),
        models.Feedback(
            title="Wrong source feedback", external_id="SYNTH-FB-SOURCE",
            respondent_type_id=alumni.id, feedback_source_id=web_source.id,
            activity_id=other_activity.id, date=date(2026, 2, 10), status="reviewed",
        ),
    ]
    outcome_type = db_session.query(models.OutcomeType).filter_by(code="participants").one()
    other_outcome_type = db_session.query(models.OutcomeType).filter_by(code="funding").one()
    outcome_rows = [
        models.Outcome(
            title="Matching outcome", external_id="SYNTH-OUT-MATCH",
            outcome_type_id=outcome_type.id, activity_id=first_activity.id,
            occurred_on=date(2026, 2, 10), is_deleted=False,
        ),
        models.Outcome(
            title="Wrong type outcome", external_id="SYNTH-OUT-TYPE",
            outcome_type_id=other_outcome_type.id, activity_id=first_activity.id,
            occurred_on=date(2026, 2, 10), is_deleted=False,
        ),
        models.Outcome(
            title="Wrong context outcome", external_id="SYNTH-OUT-CONTEXT",
            outcome_type_id=outcome_type.id, activity_id=other_activity.id,
            occurred_on=date(2026, 2, 10), is_deleted=False,
        ),
    ]
    db_session.add_all(feedback_rows + outcome_rows)
    db_session.commit()

    headers = bearer(token_for(client, "staff"))
    feedback = client.get(
        "/api/v1/imports/export/feedback.csv",
        params={
            "source_id": coop_source.id,
            "respondent_type_id": student.id,
            "activity_id": first_activity.id,
            "status": "reviewed",
            "date_from": "2026-02-10",
            "date_to": "2026-02-10",
        },
        headers=headers,
    )
    assert feedback.status_code == 200, feedback.text
    feedback_rows = list(csv.DictReader(io.StringIO(feedback.content.decode("utf-8-sig"))))
    assert [row["external_id"] for row in feedback_rows] == ["SYNTH-FB-MATCH"]

    outcomes = client.get(
        "/api/v1/imports/export/outcomes.csv",
        params={
            "outcome_type_id": outcome_type.id,
            "activity_id": first_activity.id,
            "date_from": "2026-02-10",
            "date_to": "2026-02-10",
        },
        headers=headers,
    )
    assert outcomes.status_code == 200, outcomes.text
    outcome_export_rows = list(
        csv.DictReader(io.StringIO(outcomes.content.decode("utf-8-sig")))
    )
    assert [row["external_id"] for row in outcome_export_rows] == ["SYNTH-OUT-MATCH"]


@pytest.mark.parametrize("role", ["student", "coordinator"])
def test_import_and_export_endpoints_reject_non_managers(client, cognito, role):
    headers = bearer(token_for(client, role))
    paths = (
        ("GET", "/api/v1/imports/"),
        ("GET", "/api/v1/imports/templates/feedback"),
        ("GET", "/api/v1/imports/export/feedback.csv"),
        ("GET", "/api/v1/imports/export/outcomes.csv"),
        ("GET", "/api/v1/imports/1"),
        ("POST", "/api/v1/imports/1/commit"),
        ("POST", "/api/v1/imports/1/rollback"),
    )
    for method, path in paths:
        response = client.request(method, path, headers=headers)
        assert response.status_code == 403, (method, path, response.text)

    upload = client.post(
        "/api/v1/imports/?kind=feedback",
        headers=headers,
        files={"file": ("synthetic.csv", b"external_id,title\n", "text/csv")},
    )
    assert upload.status_code == 403


def test_import_upload_uses_storage_abstraction_and_deletes_temporary_file(
    client, db_session, cognito, monkeypatch
):
    activity = models.Activity(name="Synthetic storage activity", is_published=True)
    db_session.add(activity)
    db_session.commit()
    stored_keys = []
    deleted_keys = []
    put_file = storage.put_file
    delete_file = storage.delete_file

    def tracking_put(key, content):
        stored_keys.append(key)
        put_file(key, content)

    def tracking_delete(key):
        deleted_keys.append(key)
        delete_file(key)

    monkeypatch.setattr(storage, "put_file", tracking_put)
    monkeypatch.setattr(storage, "delete_file", tracking_delete)
    headers = bearer(token_for(client, "staff"))
    response = _upload_feedback(client, headers, activity_id=activity.id)
    assert response.status_code == 202, response.text
    assert response.json()["status"] == "processing"
    assert len(stored_keys) == 1
    assert stored_keys == deleted_keys
    assert db_session.get(models.ImportBatch, response.json()["id"]).status == "previewed"
    with pytest.raises(storage.StorageError):
        storage.get_file(stored_keys[0])


def test_import_upload_storage_failure_returns_error_without_creating_batch(
    client, db_session, cognito, monkeypatch
):
    activity = models.Activity(name="Synthetic failed storage activity", is_published=True)
    db_session.add(activity)
    db_session.commit()

    def fail_put(_key, _content):
        raise storage.StorageError("synthetic storage failure")

    monkeypatch.setattr(storage, "put_file", fail_put)
    headers = bearer(token_for(client, "staff"))
    response = _upload_feedback(client, headers, activity_id=activity.id)
    assert response.status_code == 502
    assert response.json()["detail"] == "ไม่สามารถจัดเก็บไฟล์นำเข้าได้"
    assert "synthetic storage failure" not in response.text
    assert db_session.query(models.ImportBatch).count() == 0


def test_import_batch_accepts_processing_state_and_stores_preview_data(db_session):
    from datetime import datetime, timezone

    source = db_session.query(models.FeedbackSource).filter_by(code="coop_system").one()
    batch = models.ImportBatch(
        kind="feedback", feedback_source_id=source.id, file_name="synthetic.csv",
        status="processing", preview_data=[], created_at=datetime.now(timezone.utc),
    )
    db_session.add(batch)
    db_session.commit()
    assert db_session.query(models.ImportBatch).filter_by(id=batch.id, status="processing").one()
