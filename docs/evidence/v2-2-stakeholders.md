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

- `cd backend && pytest tests -q`: 50 passed, 3 skipped (PostgreSQL-only cases).
- `cd frontend && npm run lint`: passed.
- `cd frontend && npm run build -- --webpack`: passed. Webpack is used locally
  because the reused node_modules junction points outside this worktree.
- Browser regression: `frontend/tests/public-repository.cjs` exercises combined
  loading, filters, no matches, reset, detail refresh, approved contact rendering, 404,
  empty, API 503 without mock substitution, and recovery through Retry.

Run the browser regression against `npm run dev -- --port 3102 --webpack`:

```powershell
# Install Playwright in the test environment, or set PLAYWRIGHT_MODULE to an
# existing Playwright package path. Install its Chromium browser if needed.
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node frontend/tests/public-repository.cjs
```

Browser fixtures are isolated through request interception. Backend tests use
an isolated SQLite database and verify actual database reads, metadata changes,
contact permission revocation, pending-source exclusion and draft 404s.

## Integration with the existing feature branch

The branch retains remote commits `8b0dc6b` and `2380ec6` through a merge.
Their server search/filter behavior is adapted to the agreed `Partner.type`
schema and the existing `/api/v1/partners/` list contract (`search`,
`partner_type`, `country`). The earlier `category`/`contacts` fields and
`/api/stakeholders` paths do not exist in the merged V2-1 model/router setup.
Conflict resolution keeps the tested strict loaders, API aliases, explicit
contact permission and error states while preserving the remote history.

Fresh disposable demo seeds include complete stakeholder metadata and clearly
identified `demo_fixture` citations on the reserved example.test domain.
Verification of a synthetic fixture does not assert that an institution's
information or a collaboration is official. Existing real records are skipped.
