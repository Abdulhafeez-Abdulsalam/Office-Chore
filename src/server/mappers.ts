import type { Chore, ChoreAssignee, Member, OccurrenceOverride } from "@prisma/client";
import { toISODate, toUTCDate, type ChoreRule, type ISODate, type Override } from "@/lib/schedule";

export type ChoreWithAssignees = Chore & { assignees: (ChoreAssignee & { member: Member })[] };

export function toRule(chore: ChoreWithAssignees): ChoreRule {
  return {
    id: chore.id,
    title: chore.title,
    notes: chore.notes,
    startDate: toISODate(chore.startDate),
    startTime: chore.startTime,
    durationMin: chore.durationMin,
    freq: chore.freq,
    interval: chore.interval,
    byWeekday: chore.byWeekday,
    untilDate: chore.untilDate ? toISODate(chore.untilDate) : null,
    assignmentMode: chore.assignmentMode,
    assigneeIds: chore.assignees
      .filter((a) => a.member.deletedAt === null)
      .sort((a, b) => a.position - b.position)
      .map((a) => a.memberId),
  };
}

export function toOverride(o: OccurrenceOverride): Override {
  return {
    originalDate: toISODate(o.originalDate),
    skipped: o.skipped,
    overrideDate: o.overrideDate ? toISODate(o.overrideDate) : null,
    overrideMemberId: o.overrideMemberId,
    doneAt: o.doneAt,
    doneAssigneeId: o.doneAssigneeId,
  };
}

export const dbDate = (date: ISODate) => toUTCDate(date);
