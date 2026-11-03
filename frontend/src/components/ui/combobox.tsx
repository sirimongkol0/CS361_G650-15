'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  /** Optional heading for the option list, e.g. "มหาวิทยาลัย". */
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

/**
 * Searchable single-select combobox built on cmdk.
 *
 * The visible trigger is a button (so it can live inside a Field label), and
 * the open panel contains the cmdk input with the listbox and options. Radix
 * Popover portals the panel so it is not clipped by a dialog's scroll body.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'เลือก…',
  emptyMessage = 'ไม่พบตัวเลือก',
  disabled = false,
  id,
  name,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelId = React.useId();
  const selected = options.find((option) => option.value === value);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPortalContainer(triggerRef.current?.closest('dialog') ?? document.body);
    }
    setOpen(next);
    if (!next) setSearch('');
  };

  React.useEffect(() => {
    if (!open) return;
    setSearch('');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const query = search.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!query) return options;
    return options.filter((option) => {
      const haystack = [option.label, option.description ?? ''].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [options, query]);

  const groups = React.useMemo(() => {
    const grouped = new Map<string, ComboboxOption[]>();
    for (const option of filtered) {
      const key = option.group ?? '';
      const rows = grouped.get(key);
      if (rows) rows.push(option);
      else grouped.set(key, [option]);
    }
    return [...grouped.entries()];
  }, [filtered]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <PopoverPrimitive.Anchor asChild>
          <button
            ref={triggerRef}
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            onClick={() => handleOpenChange(!open)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && !open) {
                event.preventDefault();
                handleOpenChange(true);
              }
              if (event.key === 'Escape' && open) {
                event.preventDefault();
                handleOpenChange(false);
              }
            }}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-left text-sm outline-hidden transition-colors focus:border-crimson focus:ring-[3px] focus:ring-crimson/10 disabled:bg-soft disabled:text-faint',
              selected ? 'text-ink' : 'text-faint',
              selected && 'pr-16',
            )}
          >
            <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-faint" aria-hidden />
          </button>
        </PopoverPrimitive.Anchor>

        {selected && !disabled && (
          <button
            type="button"
            aria-label="ล้างตัวเลือก"
            title="ล้างตัวเลือก"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange('');
              handleOpenChange(false);
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-faint hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}

        <PopoverPrimitive.Portal container={portalContainer ?? undefined}>
          <PopoverPrimitive.Content
            id={panelId}
            role="presentation"
            align="start"
            sideOffset={4}
            avoidCollisions
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus();
            }}
            className="z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-lg border border-line bg-white shadow-card"
          >
            <Command
              shouldFilter={false}
              defaultValue={value}
              loop
              label="ค้นหาตัวเลือก"
              className="w-full"
            >
              <div className="flex items-center border-b border-line px-3">
                <Command.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder="พิมพ์เพื่อค้นหา"
                  aria-label="ค้นหาตัวเลือก"
                  className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      handleOpenChange(false);
                    }
                  }}
                />
              </div>

              <Command.List className="max-h-64 overflow-y-auto p-1" label="ตัวเลือก">
                {filtered.length === 0 && (
                  <div role="status" className="px-3 py-6 text-center text-sm text-faint">
                    {emptyMessage}
                  </div>
                )}
                {groups.map(([group, rows]) => {
                  const items = rows.map((option) => (
                    <Command.Item
                      key={option.value}
                      value={option.value}
                      onSelect={() => select(option.value)}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-sm text-ink aria-selected:bg-crimson-light aria-selected:text-crimson data-[selected=true]:bg-crimson-light data-[selected=true]:text-crimson"
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          selected?.value === option.value ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className="block truncate text-xs text-faint">{option.description}</span>
                        )}
                      </span>
                    </Command.Item>
                  ));

                  if (!group) return <React.Fragment key="ungrouped">{items}</React.Fragment>;
                  return (
                    <Command.Group
                      key={group}
                      heading={group}
                      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-faint"
                    >
                      {items}
                    </Command.Group>
                  );
                })}
              </Command.List>
            </Command>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
