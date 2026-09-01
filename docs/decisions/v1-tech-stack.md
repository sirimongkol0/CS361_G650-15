# V1 Technology Stack & Decisions

## Stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | 14.x | SSR for fast first paint; single framework for pages + API fetch layer; App Router matches the page/role structure of the project. |
| Styling | Tailwind CSS | 3.x | Design-team mock used utility-class visuals; direct port without a component library rewrite. |
| API | FastAPI + Pydantic v2 | latest stable | Auto OpenAPI docs, Pydantic alias mapping snake_case ↔ camelCase, dependency injection for DB sessions. |
| ORM | SQLAlchemy | 2.x | Declarative models shared by API, seeds, and tests; `create_all` keeps dev/CI schema in sync without a migration tool in V1. |
| Database | PostgreSQL on RDS | 16.x | Managed, matches CI service container (`postgres:15`), supports nullable additive migrations safely. |
| Object storage | AWS S3 | — | PDFs are large blobs; S3 keeps the DB metadata-only. Scoped IAM user (`cs361-partner-s3`) limited to Get/Put on `cs361-partner-docs/*`. |
| Local dev | Docker Compose | — | One command brings up backend + frontend with the right service-name networking; `NEXT_PUBLIC_API_URL` (server) vs `NEXT_PUBLIC_API_BROWSER_URL` (browser) split handles Docker DNS vs host ports. |
| CI | GitHub Actions | — | Free for the repo; runs backend pytest on a `postgres:15` service and `next build` on every push — no `.env` needed (config defaults to local storage). |
| Testing | pytest + FastAPI TestClient | — | 23 tests: endpoint contracts, publication filtering, upload validation (413/415), download round-trip, delete cleanup. |

## Decisions & Trade-offs

### 1. Additive schema instead of clean-schema rewrite
Mock-parity fields were added as nullable columns and child tables
(`document_scope_items`, `document_timeline_steps`) rather than reshaping
existing tables.
- **Gain:** existing seeds/tests untouched; pytest stayed green throughout;
  real-data DB (`partner_activity_v1`) unaffected.
- **Cost:** some columns stay `null` on real-data rows until real data fills
  them; a later cleanup pass may consolidate.

### 2. Two logical databases on one RDS instance
`partner_activity_v1` (real TU data) and `partner_activity_mock` (frontend
mock dataset) share the instance and schema; environment switches by
`DATABASE_URL` alone.
- **Gain:** demos show UI-parity data without touching real data; swapping
  back is a one-line env change; fully reversible (drop the mock db).
- **Cost:** two datasets to keep in mind when seeding (mitigated by
  `seed_mock.py` refusing non-mock databases without `--yes`).

### 3. Mock-first frontend rendering
Pages render `lib/mock.ts` immediately, then swap in API results; on API
failure they keep the mock.
- **Gain:** the UI never appears broken during backend downtime; first paint
  is instant; demo resilience.
- **Cost:** brief content swap can be visible; mock file must stay in sync
  with API shapes (single mapper file `lib/api.ts` is the adapter).

### 4. Local-storage default for tests/CI, S3 only in production
`STORAGE_BACKEND=local` is the code default; `.env` opts into S3. CI has no
secrets and exercises the same endpoints against temp dirs.
- **Gain:** CI runs with zero AWS credentials; tests stay hermetic.
- **Cost:** backend behavior differences between local and S3 are minimal but
  real (e.g., 404 on missing object) — covered by tests on the local path.

### 5. Verbatim status labels instead of enums-for-UI
Thai status labels (`เสร็จสิ้น`, `กำลังดำเนินการ`) are stored as strings,
matching the mock exactly.
- **Gain:** zero mapping drift between mock UI and API data; sorting/filtering
  by status is trivial for V1.
- **Cost:** renames later require a data update; i18n postponed to a later
  version (documented trade-off, not an oversight).

### 6. Derived document status
`expiring/expired` and `daysLeft` are computed from `expiryDate` at render
time, not stored.
- **Gain:** never stale; no cron jobs in V1.
- **Cost:** small per-request computation (negligible at V1 scale).

## What V1 Deliberately Excludes (→ V2+)

- Authentication/authorization (login page is a mock role picker)
- Partner/activity write endpoints and admin CRUD
- Feedback submission flow (read-only listing now)
- Aggregate/chart endpoints (dashboards remain mock-computed)
