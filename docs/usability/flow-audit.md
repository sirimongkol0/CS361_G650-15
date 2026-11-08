# Flow complexity audit — PCSMS lab

**Date:** 3 November 2026  
**Environment:** `https://equal-preceding-hugo-treasures.trycloudflare.com` (lab EC2 + Docker + local auth)  
**Method:** automated walkthrough with Playwright, opening forms without saving; public flow checks; DOM field counts.  
**Important:** this is a **heuristic/pre-test audit**, not a substitute for the required usability test with 3 real users from at least 2 roles.

## Summary

| Flow | Role | Controls | Required | Complexity | Main friction |
|---|---|---:|---:|---:|---|
| Login | All | 2 fields | 2 | 1/5 | None; Thai error message is clear |
| Public dashboard → list → detail → PDF | Public / student | 2–3 clicks | — | 2/5 | Date filters and empty states are understandable |
| Student exchange page | Student | 1 page | — | 2/5 | None observed |
| Create stakeholder | Coordinator / staff / admin | 12 fields, 2 selects | 1 | 3/5 | Many optional fields; publication criteria not obvious |
| Create activity | Coordinator / staff / admin | 13 fields, 5 selects | 1 | 4/5 | 33 partner options, 24 agreement options; no searchable select |
| Create agreement draft | Coordinator / staff / admin | 10 fields, 3 selects | 1 | 4/5 | 33 partner options; dates, signers, scope; publication criteria unclear |
| Manage existing agreement | Coordinator / staff / admin | 6 content sections + file/status/publish/delete | 1+ | 5/5 | One long modal; save/publish actions are below the fold |
| Submit feedback | Student / coordinator / staff / admin | 6 fields, 4 selects | 4 | 4/5 | Activity select has 93 options; no typeahead |
| Triage / reply to feedback | Coordinator / staff / admin | Filters + detail/reply | — | 4/5 (estimated) | Many filters and status actions in one list |
| Import CSV/XLSX | Staff / admin | 4 sections, 13 inputs | — | 5/5 | Multi-step: template → upload → preview → confirm; upload is disabled until a file is chosen |
| Reports | Staff / admin | 2 filters + export/print | — | 3/5 | Year and stakeholder-type filters are manageable |
| Audit logs | Staff / admin | 4 filters | — | 2/5 | Table is readable; no major issue |
| Users and roles | Admin | 1 search + tabs | — | 2/5 | Clear tabs; low complexity |
| Feedback lookups | Admin | 36 inline inputs | — | 5/5 | Dense inline editing with per-row saves |
| Outcome types | Admin | 28 inline inputs | — | 5/5 | Same density problem as feedback lookups |
| Account settings | All signed-in | 3 fields | 3 | 2/5 | Clear password-change form |

## Highest-risk findings

1. **Long plain `<select>` lists.**  
   Partner selects have 33 options, agreement selects 24, and the feedback activity select 93. Users must scan long lists; there is no search, typeahead, or context filtering. This is the most likely source of errors and slow task completion.

2. **Agreement management is an “everything modal”.**  
   One dialog contains basic data, related activities, file upload, status lifecycle, CSTU relevance, source links, save, publish/unpublish, and delete. It scrolls inside an 85vh modal; primary actions land below the fold. Users can miss the lifecycle step or publish/delete controls.

3. **Activity creation is relation-heavy.**  
   13 controls and 5 selects, though only the name is required. The user must connect the activity to the right partner and agreement, but the form does not narrow the agreement list to the selected partner. This invites mismatches.

4. **Feedback submission has high cognitive load.**  
   6 controls, 4 required, and a 93-option activity select. The activity list is not filtered by the chosen context type or partner.

5. **Imports are a multi-step flow without a visible wizard.**  
   Template download, file selection, preview, and confirmation are spread across sections. The “upload and review” button is disabled until a file is chosen, which is correct but can look broken. A first-time user may not know the intended sequence.

6. **Admin lookup pages are dense.**  
   Feedback lookups render 36 inputs and outcome types render 28, with repeated per-row save buttons. This is efficient for a power user but error-prone for occasional administrators.

7. **Mobile is not broken, but forms are long.**  
   The activity form has no horizontal overflow at 390px, but it is a single long column of 13 controls. A sticky action bar and collapsible optional sections would reduce scrolling and accidental loss.

## What is already good

- Public browsing, filtering, detail pages, PDF download, and empty states work and are easy to follow.
- Login is a single, clear form with Thai error messages and role-based redirect.
- The sidebar groups public data, work, admin, and account sections; role-specific navigation is understandable.
- Forms mark required fields with `*`; the activity form only requires the name, which supports draft-first entry.
- Native `<dialog>` is used for modals (focus trap and Esc close), and the dialog has an accessible label.
- Mobile has no horizontal overflow on the pages checked.

## Recommendations before the user test

1. Replace partner/agreement/activity selects with **searchable comboboxes**; filter agreement options by the selected partner.
2. Group long forms into **2–3 sections or steps** (basic → relations → dates/publish) and use a **sticky action bar** with Save / Cancel.
3. In agreement management, split into **tabs or accordion sections**; keep publish/delete actions in a sticky footer with confirmation.
4. Add a short **“what is needed to publish”** checklist to stakeholder, agreement, and activity forms.
5. Turn imports into a **3-step wizard**: download template → upload → preview/confirm, with a progress indicator and validation summary.
6. Add search/grouping and a single **Save all** action to feedback lookups and outcome types.
7. On mobile, collapse optional fields and keep primary actions sticky.

## Implication for TC1 / TC2

- **TC1 (public/student discovery)** should be low-friction; use it to confirm the baseline.
- **TC2 (staff/coordinator create/publish)** will expose the real complexity: long selects, relation linking, and the publish lifecycle. This is the task most likely to need moderator help.
- If the instructor’s TC2 is feedback or import instead, expect even higher assistance rates; keep the same observation sheet and severity scale.
