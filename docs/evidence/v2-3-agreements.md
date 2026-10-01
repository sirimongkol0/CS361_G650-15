# V2-3 / issue #45 evidence

This branch builds on `issue/v2-2-stakeholders`. Merge its PR first.

## Delivered behavior

- `/documents` and `/documents/[id]` read database-backed list/detail APIs.
  The detail loader requests `/api/v1/documents/{id}` directly; a partner
  summary comes from the document relationship rather than a second optional
  partner-list request. Links to unpublished or incomplete partners are null.
- Metadata includes agreement type (MoU/MoA), document kind, status, effective
  and expiry dates, responsible person, file name/type/size and scope items.
  Unknown fields remain unknown; prototype scopes/timelines are removed.
- Search, document type, status and date filters combine and can be cleared.
  Date filtering means inclusive overlap: expiry >= date_from and effective
  date <= date_to. Unknown dates do not match the requested boundary. The UI
  explains this rule. Reversed/invalid API date ranges return 422.
- Downloads use the file associated with the requested document ID. UTF-8
  filenames work in Content-Disposition. Missing files return 404; the browser
  shows an error with a retry action. Metadata-only documents have no download
  button. Loading, empty, filtered empty, error/retry and 404 states use no mocks.
- Published documents require classified metadata and a verified citation.
  Fresh disposable seeds provide labelled synthetic demo fixtures and PDFs;
  they are not official institutional agreements. Existing real rows are skipped.

## Repeatable verification

- Backend suite: **53 passed, 3 skipped** (PostgreSQL-only cases).
- Frontend: `npm run lint` and `npm run build -- --webpack` passed.
- Chromium regression: `frontend/tests/agreements.cjs` passed, covering loading,
  combined filters, inclusive date boundary, clearing, refresh, partner link,
  actual downloaded bytes/filename, missing file/retry, metadata-only, missing ID,
  list/detail 503/retry, and empty list. Requests use isolated fixtures.
- Live isolated SQLite + local storage: `scripts/verify_v2_api.py` passed with
  **8 partners, 7 documents, 10 activities and 7 PDF downloads**. Relationships
  include 7 activities with an agreement and 3 without one.
- `scripts/smoke_test.py` passed against that API and the Next.js server.

Backend tests compare list/detail responses, update metadata through the DB and
reload it, verify draft hiding and partner links, combine API filters, check
UTF-8 headers, compare stored/downloaded bytes, and remove a file to test 404.
Seed and migration tests cover repeat execution. No shared database is modified.

```powershell
cd backend
pytest tests -q
# In another terminal:
cd frontend
npm run dev -- --port 3103 --webpack
# Browser test environment (Playwright + Chromium):
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/agreements.cjs
```

Use `TEST_FRONTEND_URL` to test another frontend port and `PLAYWRIGHT_MODULE`
to reuse an existing Playwright package. For local API smoke checks, use a
disposable DB via DATABASE_URL and separate LOCAL_STORAGE_DIR, run
`scripts/prepare_v2_validation.py` following `docs/demo-v2.md`, then start the API and pass `--api` / `--frontend` to
the verification scripts. Migrate existing DB schemas before starting the app.
