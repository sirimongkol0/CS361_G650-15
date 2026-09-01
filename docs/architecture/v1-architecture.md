# V1 Architecture

## System Overview

V1 is a three-tier web system for managing TU's international partnerships:
a Next.js frontend, a FastAPI backend exposing a versioned REST API, and a
PostgreSQL database with S3 object storage for document files.

```
                         ┌──────────────────────────────────────────┐
                         │                 Browser                  │
                         └───────────────┬──────────────────────────┘
                                         │ HTTP
                    ┌────────────────────┴─────────────────────┐
                    │              Next.js (SSR)               │
                    │  src/app — pages fetch /api/v1 at render │
                    │  lib/api.ts — fetch wrapper + mappers    │
                    │  fallback: lib/mock.ts when API is down  │
                    └────────────────────┬─────────────────────┘
                                         │ REST (JSON) /api/v1
                    ┌────────────────────┴─────────────────────┐
                    │             FastAPI backend              │
                    │  routers: health, partners, activities,  │
                    │  documents, feedback, exchange, users    │
                    │  schemas.py — camelCase DTOs             │
                    │  storage.py — S3 | local-disk backend    │
                    └───────┬──────────────────────┬───────────┘
                            │ SQLAlchemy ORM       │ put/get/delete
                 ┌──────────┴──────────┐   ┌───────┴──────────────┐
                 │  PostgreSQL (RDS)   │   │  S3 bucket           │
                 │  partner_activity_  │   │  cs361-partner-docs  │
                 │  mock (demo/mockdb) │   │  PDF bytes only,     │
                 │  partner_activity_  │   │  keys per document   │
                 │  v1 (real data)     │   └──────────────────────┘
                 └─────────────────────┘
```

## Layers & Responsibilities

| Layer | Tech | Responsibility |
|---|---|---|
| Frontend | Next.js 14 + TypeScript, Tailwind | Pages, role dashboards, all presentation. Fetches `/api/v1` server-side; renders from `mock.ts` first, swaps in live data on success, keeps mock on failure. |
| API | FastAPI + Pydantic v2 | Versioned REST under `/api/v1`. Routers are thin; response shapes are camelCase DTOs mapped from snake_case ORM models. Publication filtering (`is_published`) lives here. |
| Persistence | SQLAlchemy + PostgreSQL (RDS) | Relational data: partners, activities, documents (+ scope/timeline children), feedbacks, exchange students, admin profiles. All mock-coverage columns are nullable and additive. |
| Object storage | S3 (scoped IAM) | PDF bytes only — never in the database. Scoped credential may Get/Put objects under `cs361-partner-docs/*`; delete-by-key denied by policy. |
| CI | GitHub Actions | Two jobs per push: backend pytest (Postgres service, no `.env` — local storage default) and frontend `next build`. |

## Key Design Decisions

1. **Additive-only schema growth.** V1 mock-parity fields
   (`participants`, `location`, `mouDocId`, document signers, etc.) were added
   as nullable columns/child tables instead of altering existing columns, so
   older seeds and tests keep working unchanged (pytest 23/23 before and after).
2. **Separated mock vs real databases on one RDS instance.**
   `partner_activity_v1` holds real TU data; `partner_activity_mock` holds the
   frontend mock dataset. Same schema, swap by changing `DATABASE_URL` only —
   nothing else moves, and the real dataset is never contaminated.
3. **Bytes in S3, metadata in Postgres.** The `documents` table stores only
   `storage_key`; uploads stream through the backend to the storage backend
   (`STORAGE_BACKEND=s3|local`), keeping DB dumps small and replication fast.
4. **Mock-first rendering with live swap.** Every data page renders from
   `lib/mock.ts` on first paint, then swaps to API data when the fetch
   succeeds. If the API is down, pages stay byte-identical to the mock —
   the UI never breaks because of the backend.
5. **UI data vs UI decoration split.** Database stores data (names, dates,
   statuses as verbatim labels); visual identity (initials, badge colors,
   flag emojis) is derived in the frontend mapper, so a theme change never
   touches the database.
6. **Derived status over stored drift.** Document `expiring/expired` states
   and `daysLeft` are computed from `expiryDate` at render time instead of
   being cached, so nothing goes stale.

## Data Flow (document download)

```
Browser → GET /api/v1/documents/{id}/download
        → backend looks up storage_key in Postgres
        → storage.get_file(key) streams bytes from S3
        → 200 with Content-Disposition: attachment
```

## V1 Scope Boundary

- Read-only public data + document upload/delete. No auth, no partner/activity
  CRUD (V2+).
- Dashboard charts and student personal data remain frontend mock — no
  aggregate endpoints yet by design.
