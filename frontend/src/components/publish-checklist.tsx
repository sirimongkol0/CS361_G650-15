'use client';

import { CheckCircle2, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface PublishCheckItem {
  label: string;
  done: boolean;
  hint?: string;
}

export interface PublishChecklistProps {
  items: PublishCheckItem[];
  title?: string;
  className?: string;
}

/**
 * Readiness hints for records that are only public after several fields and a
 * verified source exist. This mirrors the backend criteria; it is guidance, not
 * enforcement — the backend remains the source of truth.
 */
export function PublishChecklist({
  items,
  title = 'พร้อมเผยแพร่เมื่อ',
  className,
}: PublishChecklistProps) {
  return (
    <div className={cn('rounded-md border border-line bg-paper p-3', className)}>
      <p className="text-xs font-semibold text-ink">{title}</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.label}
            className={cn('flex items-start gap-1.5 text-xs', item.done ? 'text-green-700' : 'text-faint')}
          >
            {item.done
              ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
            <span>
              {item.label}
              {item.hint && <span className="block text-faint">{item.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
