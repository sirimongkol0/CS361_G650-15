# V2-5 / issue #47: repository relationships

Validated on 2026-10-01 (Asia/Bangkok).

## Implementation

- Stakeholder detail lists published agreements and activities, matched by database partner IDs.
- Agreement detail lists published activities matched by the document foreign key and retains its stakeholder link.
- Activity detail retains stakeholder/agreement links and explicitly shows an empty state when no public agreement exists.
- Related lists have independent loading, empty, error and retry states. No mock fallback or hardcoded relationship IDs.
- Shared public eligibility predicates apply to list/detail partner queries and eager-loaded relationship targets. Draft, pending-source and incomplete targets are excluded, even when the activity/document itself is public.

## Automated evidence

- Backend: `venv/Scripts/python.exe -m pytest -q` — 58 passed, 3 skipped.
- Frontend: `npm run lint` — passed (TypeScript).
- Frontend: `npm run build` — passed.
- `git diff --check` — passed.

`backend/tests/test_relationships.py` adds five integration cases covering two independent stakeholder/agreement/activity chains, an empty stakeholder, an activity without an agreement, draft/pending/incomplete relationship targets, and a public document referencing an unverified partner. Tests use an isolated SQLite database and real model foreign keys.

## Browser integration audit

`frontend/tests/relationships.cjs` passed against the real FastAPI app with isolated in-memory SQLite fixtures from `backend/tests/serve_relationship_fixture.py`. Browser requests are forwarded to this real test API; HTTP 503 is injected only for outage cases. Fixture records are test data, not production mock fallbacks.

- [x] Stakeholder → Agreement / Activity clicks open the matching detail.
- [x] Agreement → Stakeholder click returns to the matching stakeholder.
- [x] Activity → Agreement / Stakeholder clicks open the matching detail.
- [x] Two independent chains show only their own related records.
- [x] Empty stakeholder, agreement without activities, and activity without agreement show empty states.
- [x] Loading state appears while requests are held.
- [x] Three related-list HTTP 503 cases recover after clicking Retry.
- [x] Four detail HTTP 503 cases (two stakeholders, one agreement and one activity) recover after clicking Retry.
- [x] Ineligible targets have no exposed relationship links; direct access is hidden.
- [x] No browser runtime errors.
- [x] Desktop screenshots inspected for stakeholder, agreement and activity detail.
- [x] Integration tests and screenshots are included with this change for PR review.

Screenshots focus on V2 repository relationships; prototype account controls are hidden only during capture.

Screenshots: [Stakeholder](v2-5-stakeholder.png), [Agreement](v2-5-agreement.png), [Activity](v2-5-activity.png).

To reproduce from the repository root (separate terminals):

```powershell
backend/venv/Scripts/python.exe backend/tests/serve_relationship_fixture.py
cd frontend
npm run build
npm run start -- --port 3125
```

In another terminal at the repository root, make Playwright available using `NODE_PATH` or `PLAYWRIGHT_MODULE`, then run `node frontend/tests/relationships.cjs`. The fixture server writes `.tmp-v2-5-ids.json` for the browser test. Stop both test servers when finished.

## Review limits

Related lists use existing public list APIs and filter by foreign keys in the client; server-side pagination would require corresponding relationship filters. PostgreSQL-specific cases remain skipped in the default SQLite run. This change is isolated on `issue/v2-5-repository-integration`, based on `origin/main` after V2-2/V2-3 merged.
