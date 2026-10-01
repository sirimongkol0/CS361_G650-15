"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

/*
 * List-page search box: press "/" anywhere to focus it, Esc clears it,
 * and the X button clears it with the mouse. Typing is debounced so the URL
 * (and browser history) is not rewritten on every keystroke.
 */
const DEBOUNCE_MS = 200;

export function SearchInput({
  className,
  placeholder,
  value,
  onChange,
}: {
  className: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow outside changes (clear-filters button, chips, back/forward).
  useEffect(() => setText(value), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (next: string, immediate = false) => {
    setText(next);
    clearTimeout(timer.current);
    if (immediate) onChange(next);
    else timer.current = setTimeout(() => onChange(next), DEBOUNCE_MS);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex-1 min-w-48">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
      <input
        ref={ref}
        type="search"
        className={`${className} pl-9 pr-16 [&::-webkit-search-cancel-button]:hidden`}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-keyshortcuts="/"
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && text) {
            event.preventDefault();
            change("", true);
          }
        }}
      />
      {text ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:bg-soft hover:text-ink"
          onClick={() => {
            change("", true);
            ref.current?.focus();
          }}
          aria-label="ล้างคำค้นหา"
          title="ล้างคำค้นหา (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:block rounded border border-line px-1.5 text-[11px] text-faint">
          /
        </kbd>
      )}
    </div>
  );
}
