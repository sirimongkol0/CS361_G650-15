"use client";

import { useEffect, useState } from "react";

/*
 * useState mirrored into a URL query parameter, so list filters survive
 * back/forward navigation and can be shared as a link. The default value is
 * kept out of the URL. Reads window.location directly (instead of
 * useSearchParams) so pages don't need a Suspense boundary.
 */
export function useUrlState(key: string, defaultValue: string) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const sync = () => setValue(new URLSearchParams(window.location.search).get(key) ?? defaultValue);
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("pcsms:url-state", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("pcsms:url-state", sync);
    };
  }, [key, defaultValue]);

  const update = (next: string) => {
    setValue(next);
    const url = new URL(window.location.href);
    if (next === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, next);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new CustomEvent("pcsms:url-state", { detail: { key } }));
  };

  return [value, update] as const;
}
