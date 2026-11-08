# UX implementation summary

> **Port note:** this branch keeps `feature/local-auth` and deliberately excludes
> TOTP MFA. The MFA rows below describe the original `ux-improvements` branch,
> not this port.

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

## P4 desktop usability fixes (post-audit)

| Change | Commit | Evidence |
|---|---|---|
| Login desktop no longer scrolls horizontally; role label contrast >= 4.5:1 | `028e465` | `v3-auth` 7 passed; axe desktop clean |
| Feedback starts with no rating and no context; submit waits for a choice | `38788d4` | `v3-forms` 6 passed; axe desktop clean |
| Star ratings expose `role="img"` | `38788d4` | `feedback-triage` checks the named image role |
| Visible “ตั้งแต่วันที่ / ถึงวันที่” labels on documents and activities | `189402b` | `v2-improvements` waits for both labels |
| Admin lookup row inputs get per-row accessible names | `a7a9a15` | `admin-lookups` uses the labels; axe label violation cleared |
| Activity display utility stays standalone for `test:display` | `483516a` | `npm run test:display` passed |

**Scope note:** mobile-only findings (dashboard grids, public table card layout) are intentionally deferred. P4 does not change responsive layout.

**Deployment:** P4 is frontend-only and was deployed to the lab without touching the backend or database. The quick-tunnel URL changes after every instance restart.

## P5 local-auth hardening (4 Nov 2026)

| Change | Commit | Evidence |
|---|---|---|
| Local-auth backend merged from `feature/local-auth` | `94260d4` | `test_local_auth.py` 7 passed |
| TOTP MFA, encrypted secrets, QR provisioning and one-time backup codes | `218af93` | `test_local_mfa.py` 8 passed |
| Login/MFA rate limiting with `Retry-After` | `218af93` | 5 failures → 429; MFA challenge limit tested |
| Password-first MFA challenge (5-minute single-use token) | `218af93` | challenge cannot access `/auth/me`; replay rejected |
| MFA second login step and Settings enrollment card | `914d824` | `tests/mfa.cjs` 2 checks passed |
| Permanent MFA Playwright test wired into CI | `914d824` | `.github/workflows/ci.yml` |

**Scope note:** email verification and forgot-password are not included; they need an email provider/domain. Rate limiting is process-local because the deployment runs one uvicorn worker; Redis is the upgrade path if workers are added.

**Deployment:** P5 backend and frontend were deployed to the DigitalOcean droplet on 4 Nov 2026. The startup `create_all` created `mfa_totp` and `mfa_backup_codes`; a temporary live account completed setup → enable → MFA login challenge → disable, then was removed. MFA remains opt-in; no demo account has it enabled yet.

## UI cleanup pass (4 Nov 2026)

| Change | Commit | Evidence |
|---|---|---|
| Settings split into password + MFA columns; account email shown in MFA login step | `c44c7f9` | desktop screenshot; `mfa.cjs` |
| MFA/backup-code copy made consistently Thai | `c44c7f9` | `mfa.cjs`; WCAG axe clean |
| Audit action labels for MFA enable/disable/backup rotation | `c44c7f9` | audit page no longer shows raw action codes |
| Admin lookups column “Code” → “รหัส”; imports Template/Preview → Thai | `c44c7f9` | live checks passed |
| Smoke-test MFA audit rows removed from demo data | — | audit page check passed |

Full desktop crawl: **28 pages / 5 roles**, no horizontal overflow, no WCAG A/AA axe violations, no console errors, one `h1` per page. The production compose uses prebuilt images, so the frontend was built locally and transferred before recreating the container.

## Terminology pass (4 Nov 2026)

| Change | Commit | Evidence |
|---|---|---|
| `หน่วยงานคู่ความร่วมมือ` → `หน่วยงานความร่วมมือ` across nav, filters, forms and dashboards | `97e7440` | `v3-forms`, `scope-level` passed; live pages no old term |
| `ระดับความร่วมมือ` → `ขอบเขตความร่วมมือ`; `หลักสูตร CSTU` → `ระดับหลักสูตร (CSTU)` | `97e7440` | `scope-level`, `scope-summary` passed |
| `ประเภทผู้ส่ง` → `ประเภทผู้ให้ความคิดเห็น` | `97e7440` | `feedback-triage`, `admin-lookups` passed |
| Documents use `เอกสาร` as the umbrella; MoU/MoA use `รูปแบบ` and document kind uses `ชนิดเอกสาร` | `97e7440`, `2a0823c`, `ef38caa` | `agreements`, `v2-improvements`, `v3-agreements` passed |
| CSTU review label `รอตรวจ` → `รอตรวจสอบ` | `97e7440` | build + auth suites passed |
| Native file picker replaced with Thai `เลือกไฟล์` control | `97e7440` | `imports.cjs` passed; live page has no “Choose File” |
| Demo lookup `partner` label updated in seed and live DB | `7e393d5` | `/feedback` no longer shows the old term |

Live verification after deploy: documents header shows `รูปแบบ` / `ขอบเขต`, activity form uses `หน่วยงานความร่วมมือ` / `ขอบเขตความร่วมมือ`, and feedback uses `ประเภทผู้ให้ความคิดเห็น`.

## Brand mark (4 Nov 2026)

| Change | Commit | Evidence |
|---|---|---|
| Favicon/app icon use the unmodified official TU emblem (512px PNG, ICO, 180px Apple icon) | `2f63283` | live `/favicon.ico`, `/icon.png`, `/apple-icon.png` return 200 |
| Sidebar/login show the same official emblem at 36px/44px; the crimson rounded frame was removed | `2f63283` | live login mark 44px, sidebar mark 36px; `v3-auth`, `v2-improvements`, `v3-forms` passed |
| Frontend image copies `public/` so the emblem is served in production | `7a117c8` | live `/tu-emblem.png` returns 200 |
| No colour changes, cropping, or added graphic elements | — | official source: Thammasat Identity (Main logo artwork) |

The emblem is the official university seal. The 2568 seal regulation and the 2558 University Act (ss. 86/89) restrict modification and non-university use; keep the artwork unmodified and confirm permission before any public/official launch.

## Verification (3 Nov 2026)

| Command / check | Result |
|---|---|
| Backend `pytest tests -q` | 760 passed, 6 skipped (P5) |
| `npm run lint` | pass |
| `npm run build` | pass |
| `npm run test:display` | pass |
| `npm run test:scope` | pass |
| `tests/v3-forms.cjs` | 6 passed |
| `tests/v3-agreements.cjs` | 6 passed |
| `tests/feedback-triage.cjs` | passed |
| `tests/imports.cjs` / `tests/admin-lookups.cjs` | passed |
| `tests/v3-auth.cjs` | 7 passed (desktop login layout + contrast) |
| `tests/mfa.cjs` | 2 passed (login challenge + settings enrollment) |
| `tests/v2-improvements.cjs` | 4 passed |
| Desktop axe (P4/P5 pages) | clean on login, settings, documents, activities, feedback, admin lookups |
| Mobile 390px | out of scope for P4; prior checks remain |
| Live lab | DigitalOcean backend/frontend healthy; health 200; live MFA setup/challenge/disable smoke test passed |

Temporary harnesses were removed after verification; no `/dev` route remains in the build.

## Notes and remaining work

- **Git was not pushed.** The branch remains local.
- The live lab is a temporary EC2 instance behind a Cloudflare **quick tunnel**. Its URL changes whenever the instance restarts, and AWS Academy stops the instance when the lab session ends. P3 was deployed by rebuilding both the backend and frontend containers; the lab's local-auth patch (`local_auth.py`, `auth.py`, `config.py`, `compose.lab.yml`) was preserved, and only the five changed P3 backend files were copied. A lab reset will wipe this deployment.
- P3 changes backend validation and API response fields (`publiclyVisible`) but adds **no database migration**. Local auth remains a lab-only configuration.
- `tasks/plan.md` and `tasks/todo.md` are local only; the repository ignores `tasks/`.
- Imports and admin checks are permanent Playwright tests (`frontend/tests/imports.cjs`, `frontend/tests/admin-lookups.cjs`) and are wired into the CI e2e step.
- `cmdk@1.1.1` is pinned; production dependency audit reports 0 vulnerabilities.
- The combobox portals into the nearest native `<dialog>` when opened inside a modal, so the panel stays in the dialog top layer instead of behind it.
