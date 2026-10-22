import type { ChoreRule } from "./types";

export interface RemovalImpact {
  choreId: string;
  title: string;
  effect: "unassigned" | "rotation-shrinks";
}

/** What removing `memberId` does to each chore they are on, for the confirmation dialog. */
export function previewRemoval(memberId: string, rules: ChoreRule[]): RemovalImpact[] {
  return rules
    .filter((r) => r.assigneeIds.includes(memberId))
    .map((r) => ({
      choreId: r.id,
      title: r.title,
      effect: r.assigneeIds.length === 1 ? "unassigned" : "rotation-shrinks",
    }));
}

/** The chore's assignee list after the member is removed. */
export function withoutMember(rule: ChoreRule, memberId: string): ChoreRule {
  return { ...rule, assigneeIds: rule.assigneeIds.filter((id) => id !== memberId) };
}
