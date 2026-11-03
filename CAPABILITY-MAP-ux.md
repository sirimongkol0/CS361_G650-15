# Capability Map — UX improvements

**Status:** implemented in the `ux-improvements` worktree (all six modules); not pushed. Deployed to the temporary lab on 3 Nov 2026. See `docs/ux/implementation-summary.md`.  
**Worktree:** `/home/la/Documents/cstu/workspace/CS361_G650-15-ux`  
**Branch:** `ux-improvements` (based on `main`, not pushed)  
**Source findings:** `docs/usability/flow-audit.md` on `feature/local-auth` (lab audit, 3 Nov 2026)

## Capability modules

| Module id | Responsibility | Depends on |
|---|---|---|
| `ux-foundation` | Searchable combobox (keyboard/ARIA/mobile), form section/stepper, sticky action bar | — |
| `ux-activity` | Activity form: searchable partner/agreement, filter agreements by partner, grouped fields, sticky actions | `ux-foundation` |
| `ux-feedback` | Feedback form/triage: context-aware combobox, smart default context, reduced scan load, clear required/help | `ux-foundation` |
| `ux-agreement` | Agreement management: tabs/accordion, lifecycle, files/sources, publish/delete in sticky footer | `ux-foundation` |
| `ux-imports` | Import wizard: template → upload → preview/confirm, progress and validation summary | `ux-foundation` |
| `ux-admin` | Feedback lookups / outcome types: grouping, search, bulk-save option | `ux-foundation` |

**Proposed build order:** `ux-foundation` → `ux-activity` → `ux-agreement` → `ux-feedback` → `ux-imports` → `ux-admin`

## Decisions requested

### Q2 — Feedback required fields

Current backend rule: at least one context (`partner_id` / `activity_id` / `document_id` / `exchange_id`) is required. The frontend requires title, sender type, context ID, and comment. The 93-option activity select is the default context, which is the main friction.

| Option | Data quality | User friction | Backend change | Effort | Risk |
|---|---|---|---|---|---|
| A. Keep “at least one context” + searchable combobox + smart default context | High | Medium-low | None | S–M | Low |
| B. Make context optional / allow general feedback | Medium | Low | Yes | S–M | Medium (analytics, triage) |
| C. Keep required, but default context from entry page (activity page → activity; partner page → partner) + combobox | High | Low | None | S–M | Low |
| D. Reduce required to title + comment, derive sender type from role | Low | Lowest | Yes | S | High (loss of metadata) |

**Recommendation:** **A + C** — keep the backend rule, add a searchable combobox, and preselect context from the page the user came from. No API change; data quality preserved. If product wants “general feedback”, add it as a deliberate new context type later.

### Q3 — Agreement management layout

| Option | Space/readability | Navigation cost | Mobile | Effort | Risk |
|---|---|---|---|---|---|
| A. Tabs inside existing dialog + sticky footer | High | Low (keeps list context) | Medium | M | Low–medium |
| B. Full page `/documents/[id]/manage` | Highest | Medium (back to list) | High | M–L | Medium |
| C. Accordion inside dialog + sticky footer | Medium | Low | Medium | S–M | Low |
| D. Hybrid: quick actions in dialog + “edit full page” | Highest | Low for quick actions | High | L | Medium |

**Recommendation:** **A** for this iteration: tabs for `ข้อมูล`, `วงจรสถานะ`, `ไฟล์/แหล่งที่มา`, with a sticky footer for Save / Publish / Delete. If time permits, move to **B** for production-grade deep links and mobile space.

### Q4 — Combobox implementation

No `cmdk` or existing combobox component in the repo. `radix-ui` is already installed.

| Option | Accessibility | New dependency | Effort | Risk |
|---|---|---|---|---|
| A. `cmdk` + Radix Popover (shadcn pattern) | High, well-tested | Yes (`cmdk`) | S–M | Low |
| B. Custom Radix Popover + input + listbox | High if done carefully | No | M | Medium–high (ARIA/keyboard bugs) |
| C. Native `<select>` + `<datalist>` | Low/inconsistent | No | S | High UX/accessibility risk |

**Recommendation:** **A** if adding `cmdk` is acceptable. It is the standard shadcn/Radix path, supports Thai substring filtering, and 93 options do not need virtualization. Otherwise **B** with a strict keyboard/ARIA test matrix.

### Q5 — Admin bulk save

Current API has per-row `PATCH /feedback/lookups/{kind}/{id}` and `PATCH /outcomes/lookups/{id}`; no bulk endpoint.

| Option | Atomicity | Backend work | UX | Risk |
|---|---|---|---|---|
| A. Frontend “Save all” batches existing PATCH calls | None; partial failures | None | Good with per-row error summary | Low–medium |
| B. New bulk endpoint with transaction/per-item results | High | Yes | Best | Medium (contract/tests/audit) |
| C. Search/grouping + per-row save only | N/A | None | Medium | Lowest |
| D. Optimistic queue + retry | Medium | None | Best | High complexity |

**Recommendation:** **C first** (grouping/search fixes the density problem), then **A** if admins need “Save all”. Use **B** only if the data must be atomic or audit semantics require a single bulk event.

### Q6 — Build order

| Option | Order | Pros | Cons |
|---|---|---|---|
| A | foundation → activity → feedback → agreement → imports → admin | Quick wins on common forms | Highest-severity agreement waits |
| B | foundation → agreement → activity → feedback → imports → admin | Worst UX fixed first | Delays TC2/common activity flow; large task early |
| C | foundation → activity → agreement → feedback → imports → admin | TC2 first, then highest severity, then feedback | 93-option feedback waits |
| D | foundation + combobox rollout to all long selects → form redesigns | Fastest reduction in option-scanning | Horizontal slice; forms still long |

**Recommendation:** **C** — it balances TC2, the highest-severity agreement modal, and feedback. If the demo deadline is tight, use **A** and defer agreement/imports/admin.

## Assumptions

1. Frontend-only UX refactor; no schema changes unless a decision explicitly requires one.
2. Base branch `main`; lab deployment is a separate copy of frontend assets.
3. No push; local commits only in the worktree.
4. Existing Playwright tests remain green; new tests cover combobox keyboard/ARIA, partner→agreement filtering, feedback context default, wizard steps, and bulk-save errors.
5. Demo data only.

## Next step

After decisions on Q2–Q6, write `SPEC-ux-foundation.md` first and stop for review. Do not implement until the spec is approved.
