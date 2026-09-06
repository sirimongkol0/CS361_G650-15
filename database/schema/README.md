# Database schema (V2)

`backend/models.py` defines four V2 core tables: `partners`, `documents`,
`document_scope_items`, and `activities`.

The three main entities have `is_published BOOLEAN NOT NULL DEFAULT false`.
Scope items follow the parent document publication flag. Descriptions, URLs,
and scope text use TEXT. Names are required but may repeat. Activity dates,
scope positions, and document file metadata may be null. Document uploads store
`file_name` and `uploaded_at` (UTC); unknown historical values remain null.

Optional partner/document links use ON DELETE SET NULL; scope children use
ON DELETE CASCADE. Count, position and date-order checks remain enforced.
`document_timeline_steps` is retired. Optional `partner_contacts` and
`activity_files` are not included. Existing feedback, exchange and profile
tables belong to other features and remain available.

## Existing databases

`create_all` creates missing tables only; it does not upgrade existing columns.
Install `backend/requirements.txt`, stop applications using the target database,
take a PostgreSQL backup/snapshot, then run from the repository root:

```bash
python backend/migrate_v2.py
```

This uses the root `.env` / environment `DATABASE_URL`. Check the database name:
`partner_activity` and `partner_activity_v1` are different databases. Running
from `backend/` loads its separate `.env`. An explicit `--database-url` is also
supported; avoid placing credentials in shell history.

The migration supports SQLite and PostgreSQL, retains core rows and IDs,
repairs foreign keys, converts null publication flags to false, and removes
the timeline table and its contents. Missing required names or invalid domain
data cause transaction rollback. Repeating the migration is supported.
SQLite file backups are created automatically by the CLI before migration.

## Verification

```bash
cd backend
pytest tests -q
```

Tests use isolated SQLite and local file storage. Migration tests cover row
preservation, relationships, defaults, nullability, timeline removal,
unrelated table preservation, and repeat execution.

For PostgreSQL tests, set `TEST_DATABASE_URL` to a dedicated database whose
name ends in `_test`. Tests create/drop tables, so the test runner rejects
other PostgreSQL names. CI runs both PostgreSQL and SQLite, including empty
and populated legacy schema migration and transaction rollback checks.

See `docs/api/v2-field-contract.md` for the contract to review before merge,
and `database/seed/README.md` for repeatable seed/download commands.
