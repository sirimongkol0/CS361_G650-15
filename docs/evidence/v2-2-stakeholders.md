# V2-2 / issue #44 evidence

The stakeholder list and detail use strict API loaders with loading, empty,
error, 404 and retry states. Name/contact search, type and country filters
combine, and Clear filters resets all three controls. Prototype write buttons
are removed from these read-only pages.

Published partners must have complete identity metadata and a verified source.
Only verified citations are serialized. Coordinator name/email are returned
only when `partners.contact_is_public = true`; the flag defaults to false for
new and migrated records. This is independent of partner publication. An
internal data setup may enable it after permission has been confirmed; the UI
does not provide an approval or editing workflow.

Run `python backend/migrate_v2.py` with the application stopped before using an
existing database. The schema and migration include the source/country metadata
already prepared in the workspace, needed by the stakeholder public contract.
The migration test proves existing contact publication defaults to false.

## Validation

- `cd backend && pytest tests -q`: 49 passed, 3 skipped (PostgreSQL-only cases).
- `cd frontend && npm run lint`: passed.
- Browser regression: `frontend/tests/public-repository.cjs` exercises combined
  filters, no matches, reset, detail refresh, approved contact rendering, 404,
  empty, API 503 without mock substitution, and recovery through Retry.

Run the browser regression against `npm run dev -- --port 3102 --webpack`:

```powershell
# Install Playwright in the test environment, or set PLAYWRIGHT_MODULE to an
# existing Playwright package path. Install its Chromium browser if needed.
node frontend/tests/public-repository.cjs
```

Browser fixtures are isolated through request interception. Backend tests use
an isolated SQLite database and verify actual database reads, metadata changes,
contact permission revocation, pending-source exclusion and draft 404s.
