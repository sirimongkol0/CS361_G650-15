import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: ReactNode; href?: string };

/** Page trail above the title, as a labelled navigation landmark
 *  (https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/). The last item is the current page. */
export function Breadcrumb({ items, className = "mb-1.5" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="เส้นทางนำทาง" className={`text-xs text-faint ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              {last || !item.href
                ? <span className="text-crimson" aria-current={last ? "page" : undefined}>{item.label}</span>
                : <Link href={item.href} className="hover:text-crimson">{item.label}</Link>}
              {!last && <ChevronRight className="h-3 w-3" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
