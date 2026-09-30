import { ExternalLink } from "lucide-react";
import type { SourceView } from "@/lib/api";

export function SourceLinks({ sources }: { sources: SourceView[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="bg-white border border-line rounded-lg shadow-card p-5">
      <h2 className="font-bold mb-3 text-ink">แหล่งข้อมูลที่ตรวจสอบแล้ว</h2>
      <ul className="space-y-2">
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-crimson hover:underline"
            >
              <span>{source.title}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
            {(source.publisher || source.sourceType || source.checkedAt || source.locator) && (
              <div className="mt-0.5 text-xs text-faint">
                {[source.publisher, source.sourceType, source.checkedAt && `ตรวจสอบ ${source.checkedAt}`, source.locator].filter(Boolean).join(" • ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
