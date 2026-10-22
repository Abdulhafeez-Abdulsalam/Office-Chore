import { addDays, seriesDates } from "./dates";
import { scheduledAssignee } from "./rotation";
import type { ChoreRule, ISODate, Occurrence, Override } from "./types";

function buildOccurrence(
  rule: ChoreRule,
  originalDate: ISODate,
  index: number,
  override: Override | undefined,
  today: ISODate,
): Occurrence | null {
  if (override?.skipped) return null;
  const date = override?.overrideDate ?? originalDate;
  const done = override?.doneAt != null;
  const assigneeId = done
    ? (override?.doneAssigneeId ?? null)
    : (override?.overrideMemberId ?? scheduledAssignee(rule, index));
  return {
    choreId: rule.id,
    originalDate,
    date,
    assigneeId,
    status: done ? "done" : date < today ? "overdue" : "upcoming",
    index,
    moved: date !== originalDate,
  };
}

/**
 * Occurrences whose (possibly moved) date falls in [rangeStart, rangeEnd).
 * Completed occurrences that a later series edit no longer produces are kept, so history survives.
 */
export function expandOccurrences(
  rule: ChoreRule,
  overrides: Override[],
  rangeStart: ISODate,
  rangeEnd: ISODate,
  today: ISODate,
): Occurrence[] {
  const byDate = new Map(overrides.map((o) => [o.originalDate, o]));
  // A moved occurrence can land in range even when its original date is after it.
  const generateBefore = overrides.reduce((max, o) => {
    const next = addDays(o.originalDate, 1);
    return next > max ? next : max;
  }, rangeEnd);
  const dates = seriesDates(rule, generateBefore);
  const inSeries = new Set(dates);

  const result: Occurrence[] = [];
  const consider = (occ: Occurrence | null) => {
    if (occ && occ.date >= rangeStart && occ.date < rangeEnd) result.push(occ);
  };

  dates.forEach((date, index) => consider(buildOccurrence(rule, date, index, byDate.get(date), today)));
  for (const o of overrides) {
    if (o.doneAt && !inSeries.has(o.originalDate)) {
      consider(buildOccurrence(rule, o.originalDate, -1, o, today));
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** The single occurrence for `originalDate`, ignoring any date range. */
export function findOccurrence(
  rule: ChoreRule,
  overrides: Override[],
  originalDate: ISODate,
  today: ISODate,
): Occurrence | null {
  const dates = seriesDates(rule, addDays(originalDate, 1));
  const index = dates.lastIndexOf(originalDate);
  const override = overrides.find((o) => o.originalDate === originalDate);
  if (index === -1 && !override?.doneAt) return null;
  return buildOccurrence(rule, originalDate, index, override, today);
}

/** Overrides a series edit has orphaned. Completed ones are kept as history. */
export function staleOverrides(rule: ChoreRule, overrides: Override[]): Override[] {
  if (overrides.length === 0) return [];
  const latest = overrides.reduce((max, o) => (o.originalDate > max ? o.originalDate : max), "");
  const inSeries = new Set(seriesDates(rule, addDays(latest, 1)));
  return overrides.filter((o) => !o.doneAt && !inSeries.has(o.originalDate));
}
