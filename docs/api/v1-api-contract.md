# V1 API Contract (v1.2)

## Overview

Public read-oriented API for V1. Most endpoints are GET-only and filter to
published records. The documents resource additionally supports upload (POST)
and delete (DELETE), which power the document management flow.

Base URL: `/api/v1`

- Server-to-server (inside Docker network): `http://partner_activity_backend:8000/api/v1`
- Browser (outside Docker): `http://localhost:8000/api/v1`

Changelog vs initial draft: added activity mock-coverage fields
(`endDate`, `participants`, `location`, `time`, `status`, `isOpen`,
`mouDocId`), document lifecycle fields (`responsible`, `status`,
`signerOur`, `signerPartner`, `scopeItems`, `timelineSteps`), and three new
read-only resources: feedback, exchange, users (admin profiles).
All additions are optional/nullable — the original endpoints remain
backwards compatible.

---

## Endpoints

### GET /api/v1/health

Health check.

**200 OK**

```json
{ "status": "healthy" }
```

---

### GET /api/v1/partners/

List all **published** partners.

**200 OK**

```json
[
  {
    "id": 1,
    "name": "มหาวิทยาลัยเชียงใหม่",
    "description": "Partner university, northern Thailand",
    "logoUrl": null,
    "type": "university",
    "country": "ไทย",
    "websiteUrl": null,
    "contactName": null,
    "contactEmail": null
  }
]
```

Field notes: `type` is one of `university | government | private_company |
nonprofit | alumni_network` (nullable). UI maps these to Thai labels.
### GET /api/v1/partners/{id}

Single published partner. **404** if missing or unpublished:

```json
{ "detail": "Partner not found" }
```

---

### GET /api/v1/activities/

List all **published** activities ordered by `date`, each with a nested
partner summary (`null` when the activity has no partner).
The summary is also `null` when the linked partner is not published; a
published activity never exposes a draft partner indirectly.

**200 OK**

```json
[
  {
    "id": 1,
    "name": "อบรมเชิงปฏิบัติการ AI for Education",
    "date": "2025-08-20",
    "description": null,
    "activity_type": "workshop",
    "endDate": null,
    "participants": 45,
    "location": null,
    "time": null,
    "status": "เสร็จสิ้น",
    "isOpen": true,
    "mouDocId": 2,
    "partner": { "id": 2, "name": "National Taiwan University" }
  }
]
```

Field notes:

- `date` / `endDate` are ISO `YYYY-MM-DD` (display formatting to Thai
  Buddhist-era strings is a frontend concern).
- `activity_type`: `exchange | internship | cooperative_education |
  academic_event | workshop` (nullable).
- `status` is a display label stored verbatim (Thai), e.g. `เสร็จสิ้น`,
  `กำลังดำเนินการ`, `วางแผน`.
- `mouDocId` links to the backing MoU/MoA in `documents` (nullable).

### GET /api/v1/activities/{id}

Single published activity (same shape). **404** if missing or unpublished.

---

### GET /api/v1/documents/

List all **published** documents with lifecycle metadata. Scope items and
timeline steps are embedded per document (used by the document detail page —
there is intentionally no separate `GET /documents/{id}`).

**200 OK**

```json
[
  {
    "id": 1,
    "name": "MoU ความร่วมมือทางวิชาการ มช.",
    "docType": "mou",
    "storageKey": "mock/agreements/mock-doc-1.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1234,
    "effectiveDate": "2024-01-01",
    "expiryDate": "2028-12-31",
    "partnerId": 1,
    "responsible": "ผศ.ดร.วิชัย สอนดี",
    "status": "active",
    "signerOur": "รศ.ดร.ประธาน มหาวิทยาลัย",
    "signerPartner": "รศ.ดร.สมชาย ใจดี",
    "scopeItems": [
      { "id": 1, "position": 1, "text": "การแลกเปลี่ยนนักศึกษาและบุคลากร" }
    ],
    "timelineSteps": [
      { "id": 1, "position": 1, "label": "Draft", "date": "2023-11-01", "done": true, "current": false }
    ]
  }
]
```

Field notes: `docType`: `mou | moa | template | announcement`.
`status`: `active | expiring | expired | draft`.

### POST /api/v1/documents/

Upload a PDF (`multipart/form-data`, field `file`, optional `name`).
Bytes go to the storage backend (S3 in production, local disk in dev/CI);
only metadata is stored in the DB.

- **201** — created document (same shape as list item)
- **413** — file larger than 10 MB
- **415** — non-PDF content type

### GET /api/v1/documents/{id}/download

Stream the stored file. **200** with `Content-Disposition: attachment`,
or **404** if the document or underlying object does not exist.

### DELETE /api/v1/documents/{id}

Delete the document row and best-effort delete its file from storage.
**204** on success, **404** if missing.

---

### GET /api/v1/feedback/

List published feedback entries, newest first.

**200 OK**

```json
[
  {
    "id": 1,
    "title": "ความพึงพอใจการอบรม AI for Education",
    "source": "ผู้เข้าร่วมกิจกรรม",
    "rating": 5,
    "date": "2025-08-21",
    "status": "ตรวจสอบแล้ว",
    "comment": "กิจกรรมมีประโยชน์มาก...",
    "partnerId": 2,
    "activityId": 1
  }
]
```

### GET /api/v1/feedback/{id} — single entry or **404**.

---

### GET /api/v1/exchange/

List published exchange student records.

**200 OK**

```json
[
  {
    "id": 1,
    "name": "นายสมศักดิ์ ใจดี",
    "type": "outbound",
    "fromProgram": "หลักสูตรวิทยาการคอมพิวเตอร์",
    "toOrganization": "National Taiwan University",
    "startDate": "2025-02-01",
    "endDate": "2025-05-31",
    "program": "Student Exchange",
    "status": "เสร็จสิ้น",
    "partnerId": 2,
    "activityId": null
  }
]
```

`type`: `outbound | inbound`.

### GET /api/v1/exchange/{id} — single record or **404**.

---

### GET /api/v1/users/

List admin/staff profiles (settings page).

**200 OK**

```json
[
  {
    "id": 1,
    "firstName": "Admin",
    "lastName": "System",
    "email": "admin@university.ac.th",
    "phone": "+66 2 123 4567",
    "position": "ผู้ดูแลระบบ",
    "department": "สำนักงานหลักสูตร"
  }
]
```

### GET /api/v1/users/{id} — single profile or **404**.

---

## Error Format

Every API error uses one stable body shape:

```json
{ "detail": "Partner not found" }
```

Missing and unpublished records deliberately return the same 404 response so
the public endpoint cannot be used to discover draft record identifiers. A
request with an invalid path parameter returns
`{"detail": "Request validation failed"}` with status 422. Unexpected server
errors return `{"detail": "Internal server error"}` without leaking internal
exception details.

| Status | Meaning |
|---|---|
| 200 / 201 / 204 | Success |
| 404 | Not found (or unpublished) |
| 413 | Upload too large (max 10 MB) |
| 415 | Upload not a PDF |
| 422 | Validation error |
| 500 | Internal server error |

## Notes

- All list endpoints filter `is_published = true` except `users`
  (admin profiles have no publication flag).
- No authentication in V1; write endpoints are limited to document
  upload/delete. Partner/activity CRUD and auth arrive in V2+.
- Dates are ISO 8601 `YYYY-MM-DD`; Thai display strings (+543 era) are
  produced by the frontend.
- Browser origins are configured through the comma-separated `CORS_ORIGINS`
  environment variable. The local default allows ports 3000 and 3001; other
  origins receive no CORS access header.
