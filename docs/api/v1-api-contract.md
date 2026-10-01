# Public API Contract - V2

The `/api/v1` prefix is retained for compatibility. This document describes
current routes; the [V2 field contract](v2-field-contract.md) defines complete
fields, aliases and publication rules.

## Public endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/v1/health` | Database readiness, `{"status":"healthy"}` |
| GET | `/api/v1/partners/` | Publicly eligible stakeholders |
| GET | `/api/v1/partners/{id}` | One public stakeholder |
| GET | `/api/v1/partners/{id}/logo` | Public stakeholder logo |
| GET | `/api/v1/documents/` | Publicly eligible documents |
| GET | `/api/v1/documents/{id}` | One public document with eligible stakeholder summary |
| GET | `/api/v1/documents/{id}/download` | Associated file bytes and UTF-8 filename |
| GET | `/api/v1/activities/` | Published activities |
| GET | `/api/v1/activities/{id}` | One published activity and eligible relationships |

Lists return JSON arrays. Detail IDs are integers. Draft/ineligible records
are absent from lists and return 404 from detail/download. Only verified
source citations and approved public partner contacts are returned.
Relationships to ineligible partners/documents are null.

## Search and filtering

| Resource | Query parameters |
| --- | --- |
| partners | `search`, `partner_type`, `country` |
| documents | `search`, `doc_type`, `status`, `date_from`, `date_to` |
| activities | `search`, `activity_type`, `status`, `date_from`, `date_to` |

Search trims surrounding whitespace and matches names without case sensitivity.
Partner search includes approved public contact names. Document/activity search
includes the name of an eligible public partner. Hidden partner names cannot
produce matches. All filters combine with AND. Country is an exact stored-name
match. Types/statuses use stored API values.

Dates are ISO calendar dates (`YYYY-MM-DD`). Document periods use inclusive
overlap: expiry >= date_from and effective <= date_to. Activity periods use
endDate (or date when endDate is unknown) >= date_from and date <= date_to.
Unknown dates cannot satisfy a requested boundary. Both resources reject
invalid dates and reversed ranges with 422. Filtering uses stored dates;
display preserves dateKind/datePrecision (announcement, deadline, month/year,
approximate). Unknown activity status and isOpen remain null; the UI shows
`ไม่ระบุ` without inferring completion/enrollment from dates.
Upload/source-check timestamps are UTC. Unknown metadata remains null.

## Public boundary and errors

Document POST/DELETE return 405 without changing rows or files. Users, feedback
and exchange list/detail routes are not mounted and return 404. CORS permits
GET from configured origins. Authentication and authorized writes are V3+.

Application errors use `{"detail":"..."}`. Statuses: 200, 404 (missing,
unpublished or unavailable file), 405 (unsupported method), 422 (validation),
500 (internal failure), 503 (database not ready). CORS preflight uses the
framework response. Download uses `Content-Disposition: attachment` and
`filename*=UTF-8''...`.

Local API: `http://localhost:8000/api/v1`; internal Compose API:
`http://backend:8000/api/v1`. Configure origins through `CORS_ORIGINS`.
