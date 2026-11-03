'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Groups related fields, with a hairline separator between sections. */
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

export interface FormActionsProps {
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  destructive?: React.ReactNode;
  className?: string;
}

/**
 * Sticky action bar for long forms. It sticks to the bottom of the nearest
 * scroll container, so the same component works inside the native dialog and
 * on a full-page form.
 */
export function FormActions({
  onCancel,
  onSave,
  saveLabel = 'บันทึก',
  cancelLabel = 'ยกเลิก',
  busy = false,
  disabled = false,
  destructive,
  className,
}: FormActionsProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/95 py-3 backdrop-blur',
        className,
      )}
    >
      {destructive && <div className="mr-auto">{destructive}</div>}
      <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onSave}
        disabled={busy || disabled}
      >
        {busy ? 'กำลังบันทึก…' : saveLabel}
      </button>
    </div>
  );
}

export interface StepIndicatorProps {
  steps: string[];
  current: number;
  className?: string;
}

/** Compact numbered progress indicator; no routing or state. */
export function StepIndicator({ steps, current, className }: StepIndicatorProps) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-2 text-xs', className)} aria-label="ขั้นตอน">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                active && 'border-crimson bg-crimson text-white',
                done && 'border-crimson bg-crimson-light text-crimson',
                !active && !done && 'border-line bg-white text-faint',
              )}
              aria-hidden
            >
              {index + 1}
            </span>
            <span className={cn(active ? 'font-semibold text-ink' : 'text-faint')}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
