/* Dashboard split of records by cooperation level (no imports, so it can be unit-tested directly). */

export interface ScopeCounts {
  /** Records labelled "program": CSTU directly. */
  program: number;
  /** Records labelled "faculty" or "university". */
  broader: number;
  /** Records without a level yet. */
  unclassified: number;
}

export function countByScope(items: { scopeLevel?: string | null }[]): ScopeCounts {
  const counts: ScopeCounts = { program: 0, broader: 0, unclassified: 0 };
  for (const { scopeLevel } of items) {
    if (scopeLevel === "program") counts.program += 1;
    else if (scopeLevel === "faculty" || scopeLevel === "university") counts.broader += 1;
    else counts.unclassified += 1;
  }
  return counts;
}
