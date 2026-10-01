# V2 repository improvements and validation

Validated on **2 October 2026 (Asia/Bangkok)** in the `CS361_DEPLOY` source
archive. No Git metadata is present, so no commit or PR is asserted.
The reproducible demo records `sourceCommit: null`, `sourceIdentityKind:
source_archive` and a SHA-256 fingerprint of application/test sources and
dependency manifests. Git checkouts retain their commit alongside the fingerprint.

## Changes within V2

| Improvement | Current behavior | Verification |
| --- | --- | --- |
| Public API boundary | Only health and repository GET routes are mounted. Document POST/DELETE return 405 without changing DB/files. Users/feedback/exchange return 404. | `backend/tests/test_documents.py`, `test_public_v2_improvements.py`, OpenAPI method/route checks |
| Authoritative activity data | Null/blank status displays “ไม่ระบุ”; null enrollment displays unknown. Dates retain announcement/deadline meaning and day/month/year/approximate precision. | `frontend/tests/activity-display.cjs`, `v2-improvements.cjs` |
| Complete search/filter | Documents search names and public partner names, with type/status/date filters; activity API also matches public partner names. Hidden partner names never produce matches. Reversed date ranges return 422. | PostgreSQL/SQLite privacy tests; combined UI filters and real API integration |
| URL filter state | Document filters survive reload and browser back. Shared URL hook synchronizes popstate and clears all filter parameters consistently. | `v2-improvements.cjs` reload/back/popstate/reset checks |
| Accurate dashboard | Latest activities sort by known date descending, unknown dates last, stable ID tie-break. Agreement KPI/list includes only `documentKind=agreement`. | Display tests and browser KPI/list checks with templates mixed into documents |
| Current docs/demo | README/setup/API guides describe V2 and reserve auth/editing for V3+. Demo uses the current synthetic dataset and works without .git. CI is configured to run new display/browser regressions. | Source-archive fingerprint test, real migration/demo preparation, smoke checks |

The existing document detail lacked a rendered download control. Its file
section now shows actual filename/type/size/availability and invokes the
existing download component only when a stored file is available. Document
status is visible in both list and detail. Metadata-only records have no download
button; missing files show an error and support retry.

## Executed checks

| Check | Result |
| --- | --- |
| Python 3.11.15, PostgreSQL 16.15 backend regression | **73 passed** |
| SQLite backend regression | **70 passed, 3 PostgreSQL-only skips** |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run test:display` | Passed |
| Production Next.js build | Passed |
| `frontend/tests/v2-improvements.cjs` | 4 groups passed; no browser runtime errors |
| `frontend/tests/agreements.cjs` | Passed, including downloaded bytes and metadata-only/missing-file cases |
| `frontend/tests/v2-integration.cjs` with real FastAPI/PostgreSQL | 14 groups passed plus no browser runtime errors (15 entries in result.json) |
| `scripts/smoke_test.py` | Passed for health, all three public lists and four public pages |
| `docker compose config --quiet` | Passed |

The real E2E database contains **5 partners / 6 documents / 5 activities**;
the public API exposes **4 / 5 / 4**. Migration runs twice and repeated
preparation preserves IDs/counts. The synthetic PDF's bytes, SHA-256 and Thai
filename are checked. Missing-file restoration is confined to the disposable
fixture storage. Normal integration requests use the real API/DB; only outage
and loading cases inject failures/delays. The separate improvements/agreements
UI suites use isolated request fixtures, not production fallbacks.

Desktop and 390px mobile screenshots were inspected. The mobile document
table scrolls within its container and does not widen the page.

## Reproduce and inspect

Follow [the V2 demo guide](../demo-v2.md). Backend test databases must be separate
from the E2E database; pytest drops/recreates tables in its own test database.
The local run used separate databases `pcsms_v2_backend_test` and
`pcsms_v2_improvements_test` in a disposable PostgreSQL container on port 5547,
API port 8136 and frontend port 3136. No shared/application database was changed.

Local artifacts are under `.tmp-v2-improvements/`: `manifest.json`,
`result.json`, `requests.json`, `screenshots/` and `ui/result.json`/screenshots.
CI stores the analogous artifacts under `.tmp-v2-6/`, including `ui/`.
These paths are ignored runtime artifacts; recreate them using the demo guide.
Historical V1/V2 evidence retains its original run dates and counts. Markdown
guides are current; PDFs under `docs/pdf` remain historical exports.

Scope stays at a public V2 repository: no login, role workflow, editing UI or
feedback/exchange integration is introduced.

## Browsing and navigation (added later, 2 October 2026)

These are client-side changes over the same public GET API; no backend route,
schema or data changed.

| Feature | Behavior | Source |
| --- | --- | --- |
| Search | Every query word must match (NFKC, case- and whitespace-insensitive); matches are highlighted. Typing is debounced 200 ms; `/` focuses the box, Esc or × clears it. | `lib/list-tools.ts`, `components/search-input.tsx`, `components/list-ui.tsx` |
| Sort | Sortable column headers, stored as `?sort=key` / `?sort=-key`; missing values always sort last. | `useSort`, `sortBy`, `SortHeader` |
| Pagination | 25 rows per page in `?page=N`; changing any other filter or sort returns to page 1, a shared `?page=` link opens on that page. | `usePagination`, `Pagination` |
| Filter chips and date presets | Active filters are shown as removable chips; documents/activities offer year presets. | `FilterChips`, `DatePresets` |
| CSV export | Exports the current filtered rows (`cstu-stakeholders.csv`, `cstu-documents.csv`, `cstu-activities.csv`) as UTF-8 with BOM for Thai text in Excel. | `downloadCsv`, `ExportCsvButton` |
| Copy link | Copies the current URL including filters. | `CopyLinkButton` |
| Detail toolbar | “Back to results” returns to the filtered list; previous/next (buttons or ←/→) follows that list's order, remembered in `sessionStorage`; copy link and native share where supported. | `components/detail-toolbar.tsx` |
| Expiry badge | Agreements ending within the dashboard's expiry window show “ใกล้หมดอายุ”, ended ones “หมดอายุแล้ว”, on dashboard, document list and detail. | `components/expiry-badge.tsx` |
| PDF preview | Document detail can show a downloadable PDF inline, fetched on demand from the existing download endpoint. | `components/document-preview.tsx` |
| Global search | Ctrl+K / ⌘K searches published partners, documents and activities (12 results max); `?` lists keyboard shortcuts. | `components/command-palette.tsx` |
| Request cache | Identical GETs within 60 s share one request; failures are not cached. | `lib/api.ts` |
| Tab titles | Pages set `<title> | CSTU PCSMS`. | `useDocumentTitle` |

### Re-run after these additions (2 October 2026)

Python 3.11.15 project venv, disposable PostgreSQL 16.15 container, Node with
Playwright 1.62.1 (Chromium). The earlier results above are kept as history.

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run test:display` | Passed |
| `npm --prefix frontend run test:scope` | Passed |
| Production Next.js build | Passed |
| SQLite backend regression | **84 passed, 4 skipped** |
| PostgreSQL backend regression | **88 passed** |
| `scripts/smoke_test.py` against the demo stack (port 3100) | Passed |
| `frontend/tests/fictional-demo.cjs` against the demo stack | Passed |
| `frontend/tests/v2-integration.cjs` with real FastAPI/PostgreSQL | **15/15 groups passed** |
| `frontend/tests/v2-improvements.cjs` | Passed (4 groups) |
| `frontend/tests/agreements.cjs` | Passed |
| `frontend/tests/public-repository.cjs` | Passed |
| `frontend/tests/scope-level.cjs` | Passed (3 groups) |
| `frontend/tests/relationships.cjs` | Not run: needs `.tmp-v2-5-ids.json` from an older preparation script |

The browser suites ran against `next start` on port 3126 and the API on port 8126.
The data came from `scripts/prepare_v2_validation.py` in a disposable
PostgreSQL 16.15 container. The fictional demo suite used the Docker demo stack.

### Investigated: date-range filter

The document date-range filter has no bug. It keeps agreements whose
effective period overlaps the range: `expiryDate >= from` and
`effectiveDate <= to`. With the range 2030-12-31 to 2030-12-31, the second row
was “MoU ตัวอย่าง C” (effective 2026–2031), which does overlap. An earlier
note in this document named “V2-6 Missing File Agreement” as that row; that
was wrong.

The extra row came only from search semantics. Every query word must appear in
some field. The word “a” in “MoU ตัวอย่าง A” also occurs in
“Sample University C”.

### Test updates for the current UI

- `backend/tests/test_v2_migration.py`: the legacy tables have no id sequence
  on PostgreSQL, so the test now inserts explicit ids. The invalid
  `scope_level` case now fails on the check constraint, not on a missing id.
- After each search `fill()`, the browser tests wait for the debounced query to
  reach `?q=`: `agreements`, `fictional-demo`, `public-repository`,
  `v2-improvements` and `v2-integration`.
- The loading state is a table skeleton (`role="status"`, “กำลังโหลดข้อมูล”),
  not a per-page heading: `agreements`, `public-repository` and
  `v2-integration`.
- Dashboard KPI labels are now “คู่ความร่วมมือ / กิจกรรม / ข้อตกลง MoU/MoA
  (CSTU โดยตรง)”, and the breakdown reads “ระดับคณะ/มหาวิทยาลัยอีก N”:
  `scope-level` and `v2-improvements`.
- The country filter shows localized labels from `countryCode`
  (JP → “🇯🇵 ญี่ปุ่น”): `public-repository`.
- In `v2-integration`, the agreement filter step no longer expects exactly one
  row. It checks that the target is shown and that every shown row matches
  the type, status and date-overlap filters, following the word-based search.
- `fictional-demo` expects the `cstu-fictional-v3` data:
  - public counts 29/23/93
  - 22 agreements, 3 alumni, 3 experts, 11 expired
  - the alumni activity “รุ่นพี่เล่า: เส้นทางสายซอฟต์แวร์”
  - the KPI label “คู่ความร่วมมือ (CSTU โดยตรง)”
