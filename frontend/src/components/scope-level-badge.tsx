import { scopeLevelColors, scopeLevelLabels, type ScopeLevel } from "@/lib/labels";

/* Cooperation-level badge; renders nothing for records that are not yet classified. */
export function ScopeLevelBadge({ level }: { level: ScopeLevel | null }) {
  if (!level) return null;
  return <span className={`badge ${scopeLevelColors[level]}`}>{scopeLevelLabels[level]}</span>;
}

/* Shared options of the "ระดับความร่วมมือ" list filter (value "all" = no filter). */
export function ScopeLevelOptions() {
  return (
    <>
      <option value="all">ระดับความร่วมมือ: ทั้งหมด</option>
      {(Object.keys(scopeLevelLabels) as ScopeLevel[]).map((level) => (
        <option key={level} value={level}>{scopeLevelLabels[level]}</option>
      ))}
    </>
  );
}
