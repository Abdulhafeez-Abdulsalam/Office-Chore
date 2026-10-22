import { RRule } from "rrule";
import type { ChoreRule, ISODate } from "./types";

const MAX_OCCURRENCES = 20000;

const RRULE_FREQ = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
} as const;

export function toUTCDate(date: ISODate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUTCDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Every date the rule produces from its start up to, but not including, `before`. */
export function seriesDates(rule: ChoreRule, before: ISODate): ISODate[] {
  if (rule.startDate >= before) return [];
  if (rule.freq === "NONE") return [rule.startDate];

  const rrule = new RRule({
    freq: RRULE_FREQ[rule.freq],
    interval: Math.max(1, rule.interval),
    byweekday: rule.freq === "WEEKLY" && rule.byWeekday.length > 0 ? rule.byWeekday : null,
    dtstart: toUTCDate(rule.startDate),
    until: rule.untilDate ? toUTCDate(rule.untilDate) : null,
  });

  const end = toUTCDate(addDays(before, -1));
  const dates: ISODate[] = [];
  rrule.all((d) => {
    if (d > end || dates.length >= MAX_OCCURRENCES) return false;
    dates.push(toISODate(d));
    return true;
  });
  return dates;
}
