# PCSMS - Partner Collaboration & Stakeholder Management

V1 is a public, read-only information service for published partner and
activity data. The supported local stack is Next.js, FastAPI and PostgreSQL.

## Start the complete stack

```bash
docker compose up --build -d --wait
python scripts/smoke_test.py
```

Open http://localhost:3000/dashboard/public. No `.env` file or cloud
credentials are required for local development.

## Documentation

- [Setup guide](docs/setup/README.md) / [คู่มือติดตั้ง](docs/setup/README-th.md)
- [Architecture](docs/architecture/v1-architecture.md) / [สถาปัตยกรรม](docs/architecture/v1-architecture-th.md)
- [API contract](docs/api/v1-api-contract.md) / [สัญญา API](docs/api/v1-api-contract-th.md)
- [Technology decisions](docs/decisions/v1-tech-stack.md) / [การตัดสินใจด้านเทคโนโลยี](docs/decisions/v1-tech-stack-th.md)
- [V1 evidence index](docs/evidence/v1-readiness.md)

The evidence index maps Issues #2, #4, #5, #6, #7, #8, #25, #32, #36 and
#37 to the current implementation and repeatable checks. Prototype-only
staff/admin pages may still use mock fallback; the supported public partner
and activity flow never does.
