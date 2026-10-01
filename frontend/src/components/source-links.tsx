import { ExternalLink } from "lucide-react";
import { formatThaiDate, type SourceView } from "@/lib/api";
import { label, sourceTypeLabels } from "@/lib/labels";

export function SourceLinks({ sources }: { sources: SourceView[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="bg-white rounded-base shadow-card p-5">
      <h2 className="font-bold mb-3 text-ink">ที่มาของข้อมูล</h2>
      <ul className="space-y-2">
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`}>
            {source.sourceType === "demo_fixture" || source.sourceType === "test_fixture" ? (
              <span className="text-sm font-medium text-ink">{source.title}</span>
            ) : <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-crimson hover:underline"
            >
              <span>{source.title}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>}
            {(source.publisher || source.sourceType || source.checkedAt || source.locator) && (
              <div className="mt-0.5 text-xs text-faint">
                {[source.publisher, source.sourceType && label(sourceTypeLabels, source.sourceType), source.checkedAt && `ตรวจสอบ ${formatThaiDate(source.checkedAt)}`, source.locator].filter(Boolean).join(" • ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
