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
| Thai `DateInput` for export date filters | `3336736` | export date fields show Thai dates |
| Feedback date filters use `DateInput`; permanent triage test + CI | `b2cd5fd`, `aa76404` | `feedback-triage` passed |
| Mobile 390px stakeholder/feedback check | — | no horizontal overflow; sticky save visible |

## Verification (3 Nov 2026)

| Command / check | Result |
|---|---|
| `npm run lint` | pass |
| `npm run build` | pass |
| `npm run test:display` | pass |
| `npm run test:scope` | pass |
| `tests/v3-forms.cjs` | 6 passed |
| `tests/v3-agreements.cjs` | 5 passed |
| `tests/v3-auth.cjs` | 6 passed |
| `tests/v2-improvements.cjs` | 4 passed |
| Temporary combobox check | 93 options, Thai filter, Arrow/Enter, Escape focus return, Home/End, clear, 390px |
| Temporary imports check | step 0 → previewed step 2 → upload step 1; upload enabled after file |
| Temporary admin check | search filters rows; save-all sends PATCH; failure/success path |

Temporary harnesses were removed after verification; no `/dev` route remains in the build.

## Notes and remaining work

- **Git was not pushed.** The live lab was updated by copying the frontend source and rebuilding the container; the branch remains local. A lab reset will wipe this deployment.
- `tasks/plan.md` and `tasks/todo.md` are local only; the repository ignores `tasks/`.
- Imports and admin checks are permanent Playwright tests (`frontend/tests/imports.cjs`, `frontend/tests/admin-lookups.cjs`) and are wired into the CI e2e step.
- No backend, auth, schema, or API changes.
- `cmdk@1.1.1` is pinned; production dependency audit reports 0 vulnerabilities.
- The combobox portals into the nearest native `<dialog>` when opened inside a modal, so the panel stays in the dialog top layer instead of behind it.
