# Combobox

Searchable single-select control for long option lists (partners, agreements,
activities, feedback contexts). Built on `cmdk` inside a Radix Popover so the
panel is not clipped by a dialog's scroll body.

- Location: `frontend/src/components/ui/combobox.tsx`
- Dependency: `cmdk@1.1.1`
- Framework: React 19 + Next.js App Router (`'use client'`)

## Usage

```tsx
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';

const options: ComboboxOption[] = [
  { value: '1', label: 'มหาวิทยาลัยรุ่งอรุณวิทยา', description: 'มหาวิทยาลัย', group: 'มหาวิทยาลัย' },
  { value: '2', label: 'บริษัท โค้ดช่างฝีมือ จำกัด', description: 'บริษัท', group: 'บริษัท' },
];

function Example() {
  const [partnerId, setPartnerId] = React.useState('');
  return (
    <Combobox
      options={options}
      value={partnerId}
      onChange={setPartnerId}
      placeholder="เลือกหน่วยงาน"
      aria-label="หน่วยงานคู่ความร่วมมือ"
    />
  );
}
```

Inside the existing `Field` component, the visible `<label>` supplies the name;
you can still pass `aria-label` when the control is used outside a `Field`.

## Props

| Prop | Type | Notes |
|---|---|---|
| `options` | `ComboboxOption[]` | `{ value, label, description?, group? }` |
| `value` | `string` | Controlled selected value |
| `onChange` | `(value: string) => void` | Called on select and on clear |
| `placeholder` | `string` | Default `เลือก…` |
| `emptyMessage` | `string` | Default `ไม่พบตัวเลือก` |
| `disabled` | `boolean` | Disables the trigger and hides the clear button |
| `id` | `string` | Trigger id for label association |
| `name` | `string` | Renders a hidden input with the value |
| `aria-label` / `aria-labelledby` / `aria-describedby` | `string` | Forwarded to the trigger |
| `className` | `string` | Wrapper class |

## Behavior

- Type in the panel input to filter by `label` and `description` (case-insensitive substring; Thai supported).
- `ArrowDown` / `ArrowUp` move the active option; `Enter` selects.
- `Home` / `End` jump to the first / last rendered option (group order).
- `Escape` closes the panel and returns focus to the trigger.
- Clicking outside closes the panel.
- `aria-expanded`, `aria-haspopup="listbox"`, and `aria-controls` are set on the trigger; the input uses the ARIA combobox/listbox pattern from `cmdk`.
- Optional groups render a heading and keep related options together.
- The panel is portaled with Radix Popover and uses the trigger width, so it stays inside the viewport on mobile.

## Accessibility notes

- The visible trigger is a button; the open panel's input is the ARIA combobox.
- The listbox and options are provided by `cmdk` (`role="listbox"`, `role="option"`, `aria-selected`, `aria-activedescendant`).
- Focus returns to the trigger on select, Escape, and outside click.
- The empty state is announced with `role="status"`.
- Keep the visible label in `Field` or pass `aria-label`; do not leave it unnamed.

## Testing

- Foundation verification: `npm run lint`, `npm run build`, manual keyboard/ARIA/390px checks.
- The first automated Playwright test lands with `ux-activity`, which exercises this component in the real activity form.
