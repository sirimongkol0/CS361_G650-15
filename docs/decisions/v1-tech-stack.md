# V1 Technology Stack and Decisions

## Stack

| Layer | Choice | Version / mode | Reason |
|---|---|---|---|
| Frontend | Next.js App Router, React, TypeScript | Next 16.3.4, React 18 | Existing page structure is preserved; the production build is typed and standalone. Next 16.3.4 removes the known high-severity dependency advisories reported by npm at verification time. |
| Styling | Tailwind CSS | 3.x | Keeps the established UI without a component-library rewrite. |
| API | FastAPI, Pydantic v2 | Python 3.11+ | Versioned OpenAPI, dependency-injected database sessions and explicit DTO aliases. |
| ORM | SQLAlchemy | 2.x | Declarative relationships, constraints and indexes shared by runtime, seed and tests. |
| Database | PostgreSQL | 16.x | Same major version in local Compose and CI; supports the relational publication model. |
| Storage | local volume or AWS S3 | selected by environment | Local/CI need no cloud credentials; production can keep document bytes outside the database. |
| Verification | pytest, Docker Compose smoke, Next build | 31 backend tests plus full-stack smoke | Covers contracts, publication filtering, schema/seed repeatability and the supported runtime path. |

## Decisions and rejected alternatives

### Strict public API loading

The public dashboard and partner/activity list/detail routes use strict API
loaders with explicit loading, empty, error and retry states.

- Chosen because users must be able to distinguish real published data from a
  failed request.
- The previous silent mock fallback was rejected for public routes because it
  masked outages and was not evidence of backend-to-database delivery.
- Prototype-only role pages may retain fallback behavior until they enter a
  supported outcome.

### API-enforced publication

FastAPI applies `is_published` to list and detail queries and suppresses a
draft partner nested in a published activity. Missing and draft IDs share the
same 404 body.

- Chosen because every client receives the same protection.
- UI-only hiding was rejected because direct API callers bypass navigation.

### Complete local Compose stack

Compose supplies PostgreSQL, a one-shot idempotent seed, FastAPI and Next.js,
connected by health-based dependencies.

- Chosen so a clean checkout has one documented start command.
- Depending on an unrelated host PostgreSQL instance was rejected because its
  schema, credentials and readiness were not reproducible.
- Development credentials are local-only defaults; the database binds to
  loopback and no production secret is committed.

### Additive V1 schema with explicit integrity

SQLAlchemy models retain compatible nullable fields while adding natural-key
uniqueness, domain checks, indexes and explicit foreign-key delete behavior.
`create_all` and the idempotent seed support clean V1 environments.

- Chosen to preserve existing data shapes while making new environments
  deterministic.
- A destructive clean-schema rewrite was rejected for V1. Versioned production
  migrations are expected after V1.

### Hermetic tests

API tests override the database dependency with a fresh in-memory SQLite
database using `StaticPool`; schema/seed checks use a separate temporary DB.

- Chosen to remove order-dependent state and developer-machine requirements.
- Sharing the configured application database was rejected because it could
  leak rows between tests or touch developer data.

### Storage abstraction

The database stores document metadata and a storage key; bytes go to a local
volume or S3.

- Chosen for hermetic local/CI runs and scalable production storage.
- Storing large binary objects directly in PostgreSQL was rejected because it
  expands backups and couples file delivery to relational queries.

See [V1 architecture](../architecture/v1-architecture.md) and the
[evidence index](../evidence/v1-readiness.md).
