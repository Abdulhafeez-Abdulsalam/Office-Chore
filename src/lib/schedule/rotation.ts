import type { ChoreRule } from "./types";

/** Who the series itself assigns to the occurrence at `index`, before any one-off overrides. */
export function scheduledAssignee(rule: ChoreRule, index: number): string | null {
  const ids = rule.assigneeIds;
  if (ids.length === 0) return null;
  if (rule.assignmentMode === "FIXED" || index < 0) return ids[0];
  return ids[index % ids.length];
}
