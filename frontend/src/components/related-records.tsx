"use client";

import Link from "next/link";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { loadDocuments, loadActivities, useApiResource } from "@/lib/api";

type Props = { kind: "agreements" | "activities"; partnerId?: number; documentId?: number };

/** Lists only published records connected by the API's database relationship IDs. */
export function RelatedRecords({ kind, partnerId, documentId }: Props) {
  const records = useApiResource(async () => {
    if (kind === "agreements") {
      const documents = await loadDocuments();
      return documents.filter((item) => item.partnerId === partnerId && item.documentKind === "agreement")
        .map((item) => ({ id: item.id, title: item.title, href: `/documents/${item.id}` }));
    }
    const activities = await loadActivities();
    return activities.filter((item) => documentId !== undefined
      ? item.mouDocId === documentId : item.partnerId === partnerId)
      .map((item) => ({ id: item.id, title: item.name, href: `/activities/${item.id}` }));
  }, [kind, partnerId, documentId]);
  const title = kind === "agreements" ? "ข้อตกลงที่เกี่ยวข้อง" : "กิจกรรมที่เกี่ยวข้อง";

  return <section className="bg-white rounded-base shadow-card p-5">
    <h2 className="font-bold mb-3 text-ink">{title}</h2>
    {records.status === "loading" ? <LoadingState compact />
      : records.status === "error" ? <ErrorState compact error={records.error} onRetry={records.retry} />
      : records.data.length === 0 ? <EmptyState compact title={`ยังไม่มี${title}ที่เผยแพร่`} />
      : <ul className="space-y-3">{records.data.map((item) => <li key={item.id}>
        <Link href={item.href} className="text-sm font-semibold text-crimson hover:underline">{item.title}</Link>
      </li>)}</ul>}
  </section>;
}
