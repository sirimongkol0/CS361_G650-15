# V2 field contract for review (#43)

This supersedes the timeline-related document fields in the V1 API notes.
The agreed core contains four tables. The optional contact/file tables are
not introduced. Other existing feature tables remain available.

## Database contract

All `id` fields are INTEGER primary keys. Only `name` on the three main
entities, `text` on scope items, and the three `is_published` flags are required
in addition to primary keys. Publication defaults to false in the database.
All other fields below may be null. Names may repeat.

| Table | Fields and types (excluding id) |
| --- | --- |
| partners | name VARCHAR; type VARCHAR; country VARCHAR; description TEXT; logo_url TEXT; website_url TEXT; contact_name VARCHAR; contact_email VARCHAR; is_published BOOLEAN |
| documents | name VARCHAR; doc_type VARCHAR; partner_id INTEGER; effective_date DATE; expiry_date DATE; responsible VARCHAR; status VARCHAR; signer_our VARCHAR; signer_partner VARCHAR; storage_key VARCHAR; file_name VARCHAR; mime_type VARCHAR; size_bytes INTEGER; uploaded_at TIMESTAMP; is_published BOOLEAN |
| document_scope_items | document_id INTEGER; position INTEGER; text TEXT |
| activities | name VARCHAR; description TEXT; activity_type VARCHAR; date DATE; end_date DATE; time VARCHAR; location VARCHAR; participants INTEGER; status VARCHAR; is_open BOOLEAN; partner_id INTEGER; mou_document_id INTEGER; is_published BOOLEAN |

Relationships:

- `documents.partner_id` and `activities.partner_id` reference `partners.id`.
- `activities.mou_document_id` references `documents.id`; no agreement is valid.
- Optional parent references become null on parent deletion.
- `document_scope_items.document_id` references `documents.id`; deleting a
  document deletes its scope items.
- Counts/sizes/positions cannot be negative; known date ranges must be ordered.
- Scope items inherit document publication; `document_timeline_steps` is removed.

## Public API mapping

The API prefix stays `/api/v1` for existing clients. Database names use
snake_case; existing response aliases remain stable:

| Database field | JSON field |
| --- | --- |
| logo_url, website_url | logoUrl, websiteUrl |
| contact_name, contact_email | contactName, contactEmail |
| doc_type, partner_id (document) | docType, partnerId |
| effective_date, expiry_date | effectiveDate, expiryDate |
| signer_our, signer_partner | signerOur, signerPartner |
| storage_key, file_name | storageKey, fileName |
| mime_type, size_bytes, uploaded_at | mimeType, sizeBytes, uploadedAt |
| scope_items relationship | scopeItems (id, position, text) |
| end_date, is_open, mou_document_id | endDate, isOpen, mouDocId |
| activity_type | activity_type (existing spelling retained) |
| partner relationship (activity) | partner (id, name), or null |

Dates use ISO dates. Upload timestamps represent UTC. Historical unknown file
names/timestamps remain null. `timelineSteps` is no longer returned.

`GET /partners/` and `/activities/` return public lists; each supports `/{id}`.
`GET /documents/` returns public metadata and ordered scope items, and
`GET /documents/{id}/download` returns PDF bytes. A separate document detail
endpoint/search UI belongs to the subsequent feature issues.

Draft entities are absent from public lists; missing/draft detail and download
requests return 404. A published record's links to draft partners/agreements
are represented as null. Scope text under a draft document is not exposed.
Publication flags themselves remain internal to filtering.

## Team review before merge

- [ ] Stakeholder owner confirms partner fields and response aliases.
- [ ] Document owner confirms scope, file metadata and removal of timeline.
- [ ] Activity owner confirms nullable dates and optional agreement/partner links.

These checks require the feature owners; automated tests do not constitute
their approval. Keep #43 open until review and merge are complete.
