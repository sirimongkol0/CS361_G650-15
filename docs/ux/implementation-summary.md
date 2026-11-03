# UX implementation summary

**Status:** all six capability modules implemented in the `ux-improvements` worktree.  
**Git:** not pushed. **Live lab:** deployed by copying this worktree’s frontend source and rebuilding the frontend container on 3 Nov 2026; backend/local auth and database were left intact.

## Modules

| Module | Commit | What changed |
|---|---|---|
| `ux-foundation` | `3760b93` | Searchable `Combobox` (`cmdk@1.1.1`), `FormSection`, `FormActions`; imports reuses the existing `StepProgress`; usage docs |
| `ux-activity` | `14ff6b7` | Partner/agreement comboboxes, agreements filtered by partner, grouped sections, sticky actions |
| `ux-agreement` | `0436c90` | Partner combobox in the create form, grouped create form, tabbed manage panel, sticky publish/delete/close footer |
| `ux-feedback` | `c6406e5` | Searchable activity/context combobox, grouped submit form, preserved backend “at least one context” rule |
| `ux-imports` | `0bd3db8` | Always-visible 3-step guide, correct previewed/confirm step, clearer file/upload state |
| `ux-admin` | `279db18` | Search/count in feedback lookups and outcome types, “save all” with per-row failure summary |

## P1 hardening (post-review)

| Change | Commit | Evidence |
|---|---|---|
| Agreement tabs set `aria-controls` only on the active tab, whose panel is mounted | `11a2b6d` | `v3-agreements` 5 passed |
| Removed unused `StepIndicator` (imports uses `StepProgress`) | `732175d` | `rg StepIndicator frontend/src` empty; build passed |
| Permanent Playwright tests for imports and admin save-all, wired into CI e2e | `67e5258` | `tests/imports.cjs`, `tests/admin-lookups.cjs` passed |
| Mobile 390px bottom-scroll check | — | last field above sticky footer; no horizontal overflow |

## P2 completeness (post-review)

| Change | Commit | Evidence |
|---|---|---|
| Publish readiness checklist + grouped stakeholder form/sections | `1c17744` | `v3-forms` 6 passed; staff checklist shown |
| Document readiness checklist in the agreement info tab | `1c17744` | `v3-agreements` 5 passed |
| Feedback status tabs, collapsed advanced filters, result count | `b2cd5fd` | `feedback-triage` passed |
| Thai `DateInput` for export, feedback, and audit date filters | `3336736` | date fields show Thai dates |
| Feedback date filters use `DateInput`; permanent triage test + CI | `b2cd5fd`, `aa76404` | `feedback-triage` passed |
| Mobile 390px stakeholder/feedback check | — | no horizontal overflow; sticky save visible |

## P3 consistency fixes (post-audit)

| Change | Commit | Evidence |
|---|---|---|
| Activity form edits `date_kind`, `date_precision`, `is_open` | `8b90e59`, `686a3ab` | `v3-forms` asserts submitted fields and cleared date semantics |
| Document form edits `document_kind` and safe `file_availability` | `6330131` | `v3-agreements` asserts create body; backend tests guard available-without-file |
| Activity agreement must belong to the selected partner | `f092615` | create/update mismatch tests; partner-less agreements still allowed |
| Document manage list exposes only verified sources | `73b7ad4` | backend test compares manage sources with public eligibility |
| Published records expose `publiclyVisible` and warn when not public | `0be4226` | partner/document backend tests; UI warning tests |
| Event dates stay unprefixed in public labels | `f2b1eb2` | `v2-improvements` regression test |
| Template documents keep an editable type | `0bade1a` | `v3-agreements` still 6 passed |

## Verification (3 Nov 2026)

| Command / check | Result |
|---|---|
| Backend `pytest tests -q` | 732 passed, 6 skipped |
| `npm run lint` | pass |
| `npm run build` | pass |
| `npm run test:display` | pass |
| `npm run test:scope` | pass |
| `tests/v3-forms.cjs` | 6 passed |
| `tests/v3-agreements.cjs` | 6 passed |
| `tests/feedback-triage.cjs` | passed |
| `tests/imports.cjs` / `tests/admin-lookups.cjs` | passed |
| `tests/v3-auth.cjs` | 6 passed |
| `tests/v2-improvements.cjs` | 4 passed |
| Mobile 390px | activity and document forms: no overflow, sticky save visible |
| Live lab | backend + frontend healthy; `publiclyVisible` present on 25 documents and 32 partners; health 200 |

Temporary harnesses were removed after verification; no `/dev` route remains in the build.

## Notes and remaining work

- **Git was not pushed.** The branch remains local.
- The live lab (https://equal-preceding-hugo-treasures.trycloudflare.com) was updated by rebuilding both the backend and frontend containers. The lab's local-auth patch (`local_auth.py`, `auth.py`, `config.py`, `compose.lab.yml`) was preserved; only the five changed P3 backend files were copied. A lab reset will wipe this deployment.
- P3 changes backend validation and API response fields (`publiclyVisible`) but adds **no database migration**. Local auth remains a lab-only configuration.
- `tasks/plan.md` and `tasks/todo.md` are local only; the repository ignores `tasks/`.
- Imports and admin checks are permanent Playwright tests (`frontend/tests/imports.cjs`, `frontend/tests/admin-lookups.cjs`) and are wired into the CI e2e step.
- `cmdk@1.1.1` is pinned; production dependency audit reports 0 vulnerabilities.
- The combobox portals into the nearest native `<dialog>` when opened inside a modal, so the panel stays in the dialog top layer instead of behind it.
