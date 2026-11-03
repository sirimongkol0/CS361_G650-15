# Spec: ux-foundation

## Objective

Provide the reusable UI primitives needed by the six UX improvements: a searchable combobox, a form section, a sticky form action bar, and a step indicator. This module is **foundation only** — it does not migrate any page by itself.

**Users:** coordinators, staff and admins filling long forms; students submitting feedback.  
**Success:** any existing long `<select>` can be replaced with a keyboard- and screen-reader-accessible searchable combobox, and long forms can be grouped with actions that stay visible.

**Non-goals**
- No backend, auth, schema or API changes.
- No page migration in this module. `ux-activity`, `ux-feedback`, `ux-agreement`, `ux-imports` and `ux-admin` consume the primitives later.
- No import wizard, bulk save, or required-field policy change.
- No push to any remote.

## Tech Stack

- Next.js 16.4.3, React 19.3.1, TypeScript 5.4.5
- Tailwind CSS 4, existing design tokens (`text-ink`, `text-faint`, `border-line`, `bg-paper`, `rounded-lg`)
- Radix UI 1.8.1 (already installed)
- New dependency: `cmdk` (approved decision Q4-A)
- Existing Playwright test tooling; no new test framework.

## Commands

```bash
cd frontend

# Add the approved dependency; record the exact version in package-lock.json
npm install cmdk

# Required checks
npm run lint          # tsc --noEmit
npm run build         # next build
npm run test:display
npm run test:scope

# Playwright test for the first real consumer (added in ux-activity)
PLAYWRIGHT_MODULE="$PWD/../.tmp-v2-tools/node_modules/playwright" \
  node tests/combobox.cjs
```

Backend commands are out of scope; no backend files are touched.

## Project Structure

```
frontend/src/components/ui/combobox.tsx     New searchable combobox primitive
frontend/src/components/form-layout.tsx     FormSection, FormActions, StepIndicator
frontend/src/components/form-ui.tsx         Existing Field/FormError/Dialog; unchanged
frontend/src/components/ui/                Existing shadcn-style primitives
frontend/tests/                            Playwright tests (consumer test in ux-activity)
docs/ux/combobox.md                        Short usage + accessibility notes
CAPABILITY-MAP-ux.md                       Approved capability map
SPEC-ux-foundation.md                      This spec
```

## Code Style

- Client components start with `'use client'`.
- Named exports only; no default exports.
- Explicit prop interfaces; no `any`.
- Tailwind classes and existing tokens; use `cn()` from `@/lib/utils` when merging classes.
- Thai UI labels; technical names in English.
- Keep the component controlled; no hidden form state.

```tsx
'use client';

import { cn } from '@/lib/utils';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn('space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0', className)}>
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-faint">{description}</p>}
      </div>
      {children}
    </section>
  );
}
```

## Component contracts

### `Combobox`

```ts
export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}
```

Required behavior:
- Filter is case-insensitive substring on `label` and `description`; trim input; Thai text supported.
- 93 options render without noticeable lag; no virtualization required.
- Keyboard: `ArrowDown`/`ArrowUp` move the active option, `Enter` selects, `Escape` closes and returns focus to the trigger, `Home`/`End` jump, typing filters.
- Mouse/touch: click trigger opens; click option selects; click outside closes.
- ARIA: trigger has `aria-expanded`, `aria-controls`, `aria-haspopup="listbox"`; list has `role="listbox"`; options have `role="option"` and `aria-selected`; active option is referenced by `aria-activedescendant`.
- Empty state: `emptyMessage` (default “ไม่พบตัวเลือก”).
- Clear button is optional; if present, it clears value and keeps focus.
- The popover stays inside the viewport at 390px; no horizontal overflow.
- No “create new” behavior in v1.

### `FormSection`

- `title`, optional `description`, children.
- Consistent vertical rhythm; top border except for the first section.
- Does not own state.

### `FormActions`

- Sticky footer inside a scroll container (`sticky bottom-0`) with a paper background and top border.
- Props: `onCancel`, `onSave`, `saveLabel` (default “บันทึก”), `cancelLabel` (default “ยกเลิก”), `busy`, `disabled`, optional `destructive` slot.
- Save button shows a busy state and is disabled while `busy` or `disabled`.
- Works inside the existing native `<dialog>` and inside a normal page.

### `StepIndicator`

- Props: `steps: string[]`, `current: number` (0-based).
- Renders numbered steps with current/completed styling; no routing, no state.
- Used by `ux-imports` later.

## Testing Strategy

- `npm run lint` and `npm run build` are the foundation gate.
- Existing `test:display` and `test:scope` must stay green.
- Manual accessibility checklist: keyboard-only navigation, screen reader announcement of listbox/option, focus return, 390px viewport, 93-option filter.
- The automated Playwright test lands with `ux-activity`, the first real consumer, because the repository has no component-test harness. It must cover:
  - filter “Sakura” finds the right partner;
  - ArrowDown + Enter selects;
  - Escape closes and returns focus;
  - no-results state;
  - no horizontal overflow at 390px.
- No new test framework and no dev-only route.

## Boundaries

**Always**
- Run `npm run lint` and `npm run build` after changes.
- Preserve existing form behavior and Thai labels.
- Keep the component controlled and accessible.
- Commit only in the `ux-improvements` worktree; do not push.

**Ask first**
- Any dependency beyond the approved `cmdk`.
- Changing required fields or validation rules.
- Adding a new route or dev-only harness.
- Changing API contracts.
- Changing CI configuration.

**Never**
- Touch backend, auth, schema, or migration files.
- Modify the `feature/local-auth` branch or lab deployment.
- Use real data or commit secrets.
- Delete or weaken existing tests.
- Push to a remote.

## Success Criteria

- [ ] `Combobox` exists in `frontend/src/components/ui/combobox.tsx` and matches the contract above.
- [ ] `FormSection`, `FormActions`, and `StepIndicator` exist in `frontend/src/components/form-layout.tsx`.
- [ ] Keyboard, ARIA, mouse/touch, empty state, and mobile viewport behavior pass the manual checklist.
- [ ] 93-option filtering is responsive and supports Thai substring search.
- [ ] `cmdk` is added, pinned in `package-lock.json`, and documented in `docs/ux/combobox.md`.
- [ ] `npm run lint`, `npm run build`, `test:display`, and `test:scope` pass.
- [ ] No page behavior changes in this module.
- [ ] No push; changes remain local in the worktree.

## Open Questions

1. **Group headers in v1:** support optional `group` labels now (useful for partner types and agreement types), or defer? Recommendation: support now; it is small and avoids a second API change.
2. **`StepIndicator` now or in `ux-imports`:** include the minimal version now (map says foundation), or defer to the first consumer? Recommendation: include now.
3. **`cmdk` version:** pin the latest stable version at implementation. Confirm no objection to the new dependency (already approved via Q4-A).
4. **Sticky footer placement in the native `<dialog>`:** use `sticky bottom-0` inside the scroll body. Confirm this is acceptable versus a fixed footer outside the scroll area.

## Next Step

On approval of this spec, write `tasks/plan.md` and `tasks/todo.md` for `ux-foundation` only, then stop for review before implementation.
