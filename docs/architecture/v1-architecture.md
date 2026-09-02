# V1 Architecture

## Supported system

V1 is a three-tier public information service. Anonymous users browse only
published partner and activity data through a Next.js frontend. FastAPI owns
the public contract and publication boundary; PostgreSQL owns relational data.
Local document bytes use a Docker volume, while production may select S3.

![PCSMS V1 supported architecture](v1-architecture-diagram.svg)

```text
Browser
  | HTTP :3000                         public GET /api/v1 :8000
  v                                               |
Next.js 16 (App Router, client data loading) -----+
  | - public dashboard, partner/activity list + detail
  | - explicit loading / empty / error / retry
  | - no mock fallback on the supported public flow
  v
FastAPI + Pydantic DTOs
  | - stable {"detail": ...} errors
  | - is_published enforced for list, detail and nested partner data
  | - health is healthy only after a database probe succeeds
  +---------------- SQLAlchemy ----------------> PostgreSQL 16
  +---------------- storage abstraction ------> local volume | S3
```

Docker Compose creates `database`, a one-shot idempotent `seed`, `backend`
and `frontend` in dependency order. The browser calls the host-reachable
`PUBLIC_API_URL`; containers share an isolated Compose network. The database
port is bound only to `127.0.0.1`.

## Layers and responsibilities

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js 16.3.4, React 18, TypeScript, Tailwind | Public navigation and presentation. Public partner/activity loaders are strict and model loading, success, empty and error as explicit states. |
| API | FastAPI, Pydantic v2 | Versioned REST under `/api/v1`; DTOs isolate ORM details; publication filtering and stable error responses are enforced here. |
| Persistence | SQLAlchemy, PostgreSQL 16 | Partners, activities, documents and child records with constraints, indexes and explicit foreign-key delete behavior. |
| Object storage | local volume or S3 | Document bytes; PostgreSQL stores metadata and storage keys only. |
| Verification | pytest, Compose smoke test, Next production build | Isolated API/schema tests plus a clean database-seed-backend-frontend integration path. |

## Key decisions

1. **The API is the publication boundary.** Lists and details filter
   `is_published`; a published activity cannot expose a draft partner through
   its nested summary. Missing and unpublished IDs deliberately return the
   same 404 shape. Relying only on hidden UI links was rejected because API
   callers could bypass them.
2. **Public routes fail visibly.** Partner/activity pages and the public
   dashboard start in loading state, render empty data explicitly and offer a
   retry after errors. The earlier mock-first fallback remains only on
   prototype pages outside the supported public V1 flow; using it publicly was
   rejected because it hid API failures and could misrepresent publication.
3. **Local V1 includes its database.** Compose runs PostgreSQL 16 and a
   one-shot seed instead of requiring an undocumented database on host
   `localhost`. Health-based dependencies make startup deterministic.
4. **Schema and seed are repeatable.** Natural keys, domain checks, indexes,
   relationships and delete behavior are declared in the models. The
   development seed is additive and idempotent. `create_all` supports clean V1
   setup; production migrations remain a post-V1 concern.
5. **Tests are isolated.** API tests override the database dependency with a
   fresh in-memory SQLite database using `StaticPool`; schema/seed tests use
   their own temporary database. This avoids order-dependent shared state.
6. **Browser and server addresses are distinct.** A browser cannot resolve a
   Compose service name, so `PUBLIC_API_URL` is embedded as a host-reachable
   URL. Backend/database traffic stays on the Compose network.

## Public request flow

```text
anonymous browser
  -> /stakeholders, /stakeholders/{id}, /activities, /activities/{id}
  -> strict loader in frontend/src/lib/api.ts
  -> GET /api/v1/partners[/id] or /activities[/id]
  -> FastAPI filters is_published and maps ORM rows to DTOs
  -> PostgreSQL
  -> success data | empty list | stable 404/error
  -> explicit frontend success | empty | error + retry state
```

## V1 boundary

- Supported: anonymous public dashboard; published partner/activity list and
  detail; repeatable local stack; API/schema/security verification.
- Existing but outside this public outcome: document management and
  prototype role pages for feedback, exchange, reports, settings and users.
- Authentication, authorization and partner/activity write workflows are V2+.

See [the evidence index](../evidence/v1-readiness.md) for the mapping from
outcomes to current code and tests.
