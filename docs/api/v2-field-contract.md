# V2 field contract for review (#43)

This supersedes the timeline-related document fields in the V1 API notes.
The agreed core contains four tables plus the source citations that gate
publication. The optional contact/file tables are not introduced. Other
existing feature tables remain available. `backend/models.py` is the source
of truth; this document must be updated together with it.

## Database contract

All `id` fields are INTEGER primary keys. Required fields in addition to
primary keys: `name` on the three main entities, `text` on scope items, the
three `is_published` flags, `partners.contact_is_public`, and the source fields
marked NOT NULL below. Publication and contact flags default to false in the
database. All other fields may be null. Names may repeat.

| Table | Fields and types (excluding id) |
| --- | --- |
| partners | name VARCHAR; type VARCHAR; country VARCHAR; country_code CHAR(2); description TEXT; logo_url TEXT; website_url TEXT; contact_name VARCHAR; contact_email VARCHAR; contact_is_public BOOLEAN; is_published BOOLEAN |
| documents | name VARCHAR; doc_type VARCHAR; document_kind VARCHAR; file_availability VARCHAR; partner_id INTEGER; effective_date DATE; expiry_date DATE; responsible VARCHAR; status VARCHAR; signer_our VARCHAR; signer_partner VARCHAR; storage_key VARCHAR; file_name VARCHAR; mime_type VARCHAR; size_bytes INTEGER; uploaded_at TIMESTAMP; is_published BOOLEAN |
| document_scope_items | document_id INTEGER; position INTEGER; text TEXT |
| activities | name VARCHAR; description TEXT; activity_type VARCHAR; date DATE; date_kind VARCHAR; date_precision VARCHAR; end_date DATE; time VARCHAR; location VARCHAR; participants INTEGER; status VARCHAR; is_open BOOLEAN; partner_id INTEGER; mou_document_id INTEGER; is_published BOOLEAN |
| sources | source_url TEXT NOT NULL UNIQUE; source_title VARCHAR; source_publisher VARCHAR; source_type VARCHAR NOT NULL; source_checked_at TIMESTAMPTZ NOT NULL; source_locator TEXT; verification_status VARCHAR NOT NULL |
| partner_sources, document_sources, activity_sources | (owner id, source_id) composite primary key |

Allowed values:

| Field | Values |
| --- | --- |
| partners.type | `university`, `government`, `private_company`, `network`, `vocational`, `healthcare`, `international_organization`, `alumni`, `expert` (labels in `frontend/src/lib/labels.ts`; the latter two represent individual stakeholders) |
| partners.country_code | ISO 3166-1 alpha-2, upper case (enforced) |
| partners.country | English short name, one spelling per `country_code` (e.g. `United States`, `United Kingdom`, `South Korea`) |
| documents.doc_type | `mou`, `moa`, `template`, `announcement` |
| documents.document_kind | `agreement`, `template`, `procedure`, `announcement`, `other` (enforced) |
| documents.file_availability | `available`, `metadata_only`, `unavailable` (enforced); `available` requires `storage_key` |
| documents.status | `active`, `expiring`, `expired`, `draft`; must agree with `expiry_date` |
| activities.activity_type | `official_event`, `collaboration_meeting`, `exchange`, `student_workshop_competition`, `student_activity`, `engineering_camp`, `seminar`, `academic_visit`, `international_conference` |
| activities.date_kind | `event`, `announcement`, `deadline`, `application_open`, `application_close`, `period_start`, `period_end` (enforced; requires `date`) |
| activities.date_precision | `day`, `month`, `year`, `approximate` (enforced; requires `date`) |
| activities.status | Thai display label: `วางแผน`, `กำลังดำเนินการ`, `เสร็จสิ้น`; when null the UI shows `ไม่ระบุ` |
| sources.source_url | must start with `https://` (enforced) |
| sources.verification_status | `pending`, `verified`, `rejected` (enforced) |

Values marked "enforced" are database CHECK constraints; the others are
conventions that the UI labels depend on.

Relationships:

- `documents.partner_id` and `activities.partner_id` reference `partners.id`.
- `activities.mou_document_id` references `documents.id`; no agreement is valid.
- Optional parent references become null on parent deletion.
- `document_scope_items.document_id` references `documents.id`; deleting a
  document deletes its scope items.
- Deleting a record or a source removes its rows in the `*_sources` tables.
- Counts/sizes/positions cannot be negative; known date ranges must be ordered.
- Scope items inherit document publication; `document_timeline_steps` is removed.

## Publication rules

`backend/public_visibility.py` decides what the public API returns:

- **Partner:** `is_published`, non-blank `name`, `type`, `description` and
  `website_url`, a `country_code`, and at least one `verified` source.
- **Document:** `is_published`, non-blank `name`, `document_kind` and
  `file_availability` set, a `storage_key` when the file is `available`, and at
  least one `verified` source.
- **Activity:** `is_published` only. Sources are returned when present but are
  not required.
- Contact name/email are returned only when `contact_is_public` is true.
- Only `verified` sources are included in responses.

## Public API mapping

The API prefix stays `/api/v1` for existing clients. Database names use
snake_case; existing response aliases remain stable:

| Database field | JSON field |
| --- | --- |
| logo_url, website_url | logoUrl, websiteUrl |
| country_code | countryCode |
| contact_name, contact_email | contactName, contactEmail (null unless public) |
| doc_type, partner_id (document) | docType, partnerId |
| document_kind, file_availability | documentKind, fileAvailability |
| effective_date, expiry_date | effectiveDate, expiryDate |
| signer_our, signer_partner | signerOur, signerPartner |
| storage_key, file_name | storageKey, fileName |
| mime_type, size_bytes, uploaded_at | mimeType, sizeBytes, uploadedAt |
| scope_items relationship | scopeItems (id, position, text) |
| end_date, is_open, mou_document_id | endDate, isOpen, mouDocId |
| date_kind, date_precision | dateKind, datePrecision |
| activity_type | activity_type (existing spelling retained) |
| partner relationship (activity, document) | partner (id, name), or null |
| sources relationship | sources (id, sourceUrl, sourceTitle, sourcePublisher, sourceType, sourceCheckedAt, sourceLocator) |

Dates use ISO dates. Upload and source-check timestamps represent UTC.
Historical unknown file names/timestamps remain null. `timelineSteps` is no
longer returned.

`GET /partners/`, `/documents/` and `/activities/` return public lists; each
supports `/{id}`. Lists accept `search`; partners also accept `partner_type`
and `country` (exact match on the stored name), documents `doc_type`, `status`,
`date_from`/`date_to`, and activities `activity_type`, `status`,
`date_from`/`date_to`. `GET /documents/{id}/download` returns PDF bytes.

Document/activity search also matches an eligible public partner's name, never
a hidden partner's name. Both resources reject reversed date ranges with 422.
The UI preserves `dateKind`/`datePrecision` and displays null status/enrollment
as unknown; no event-date inference changes the stored status or `isOpen`.

Only repository GET routes and health are mounted in the public V2 app.
Document POST/DELETE return 405 without changing data/files. Users, feedback
and exchange list/detail APIs are not mounted and return 404. Authentication,
role permissions and authorized editing are V3+.

Draft or ineligible entities are absent from public lists; their detail and
download requests return 404. A published record's links to ineligible
partners/agreements are represented as null. Scope text under a draft document
is not exposed. Publication flags themselves remain internal to filtering.

## Team review before merge

- [ ] Stakeholder owner confirms partner fields and response aliases.
- [ ] Document owner confirms scope, file metadata and removal of timeline.
- [ ] Activity owner confirms nullable dates and optional agreement/partner links.

These checks require the feature owners; automated tests do not constitute
their approval. Keep #43 open until review and merge are complete.
