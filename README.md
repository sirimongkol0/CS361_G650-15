# PCSMS - CSTU Program Collaboration & Stakeholder Management

The agreed scope is undergraduate Computer Science at Thammasat University,
Rangsit campus. The system will track the program's collaborations, with
permitted public information and an internal workspace for authorized users.
See [the CSTU scope decision](docs/decisions/cstu-program-scope.md) for data
inclusion criteria, the V1–V7 roadmap, and pending review of existing records.
This scope decision does not certify existing data as CSTU-related.

The current version is **V2 - Collaboration Repository**: a public, read-only
repository of published stakeholders, MoU/MoA agreements, documents and activities.
The supported local stack is Next.js, FastAPI and PostgreSQL.

## Start the complete stack

For the fictional course demonstration (recommended for presentations):

```powershell
docker compose -f docker-compose.demo.yml up --build -d --wait
```

Open http://localhost:3100/dashboard/public. This uses the independent
`cstu_demo` PostgreSQL database and separate storage volumes, with a visible
fictional-data notice. It preserves the real CSTU database on port 3000.
See [the fictional demo guide](docs/demo-fictional.md) for data coverage,
repeatable preparation and verification. All demo records flow through the
real API and database; there is no frontend sample-data fallback.

The current machine serves the enriched demo PDFs from S3. To preserve this
configuration when restarting, use both Compose files:

```powershell
docker compose -f docker-compose.demo.yml -f docker-compose.demo-s3.yml up -d --wait
```

See [demo S3 setup and validation](docs/demo-s3.md) before enabling S3 on a new machine.

For the isolated CSTU database on this machine, use:

```powershell
docker compose --env-file .env.cstu -f docker-compose.cstu.yml up --build -d --wait
python scripts/smoke_test.py --api http://localhost:3000/api/v1
```

See [CSTU database setup](docs/setup/cstu-database.md) for credentials setup on
a new machine, persistent volumes, and switching back to the original RDS stack.
The CSTU database starts empty and uses separate local document storage.

The original generic local stack is also available:

```bash
docker compose up --build -d --wait
python scripts/smoke_test.py
```

Open http://localhost:3000/dashboard/public. No `.env` file or cloud
credentials are required for local development.

## Documentation

- [CSTU scope and development roadmap](docs/decisions/cstu-program-scope.md)
- [Isolated CSTU database](docs/setup/cstu-database.md)
- [V2 field contract](docs/api/v2-field-contract.md)
- [V2 demo and real API/browser verification](docs/demo-v2.md)
- [Latest V2 improvements and validation](docs/evidence/v2-improvements.md)
- [Setup guide](docs/setup/README.md) / [คู่มือติดตั้ง](docs/setup/README-th.md)
- [Architecture](docs/architecture/v1-architecture.md) / [สถาปัตยกรรม](docs/architecture/v1-architecture-th.md)
- [API contract](docs/api/v1-api-contract.md) / [สัญญา API](docs/api/v1-api-contract-th.md)
- [Technology decisions](docs/decisions/v1-tech-stack.md) / [การตัดสินใจด้านเทคโนโลยี](docs/decisions/v1-tech-stack-th.md)
- [V1 evidence index](docs/evidence/v1-readiness.md)

The V1 evidence index is historical. V2 supports list/detail, combined search
and filters, sorting, pagination, CSV export, global search (Ctrl+K), PDF
preview, published relationships, source citations and downloads. Public
APIs expose only GET operations for health, partners, documents and activities.
Document upload/delete and the users, feedback and exchange APIs are unavailable
in this public application. Authentication and authorized writes belong to V3+.

Unknown activity status and enrollment are displayed as unknown; date labels
retain announcement/deadline meaning and month/year/approximate precision.
Dashboard activities are ordered newest first and agreement counts exclude
templates and announcements.

Pages never substitute test data for API results; a fresh generic local
database starts empty. Tests use synthetic data in `backend/tests/sample_data.py`.
`scripts/prepare_v2_validation.py` prepares only disposable `*_test` databases
or `*_test.db` files; these fixtures are not official institutional agreements.
Follow the V2 demo guide for a separate validation environment. PDFs under
`docs/pdf` are historical exports; the linked Markdown guides are current.
