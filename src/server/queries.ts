import "server-only";
import { expandOccurrences, type ISODate } from "@/lib/schedule";
import { UNASSIGNED_COLOR, type ChoreEvent, type MemberDTO } from "@/lib/events";
import { db } from "./db";
import { dbDate, toOverride, toRule } from "./mappers";

export async function getActiveMembers(): Promise<MemberDTO[]> {
  return db.member.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, color: true },
  });
}

function addMinutes(date: ISODate, time: string, minutes: number): string {
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

export async function getCalendarEvents(params: {
  from: ISODate;
  to: ISODate;
  today: ISODate;
  /** Member ids to include; "none" stands for unassigned. Undefined means everyone. */
  only?: string[];
}): Promise<ChoreEvent[]> {
  const { from, to, today, only } = params;
  const [chores, members] = await Promise.all([
    db.chore.findMany({
      where: {
        OR: [
          { startDate: { lt: dbDate(to) } },
          { overrides: { some: { overrideDate: { gte: dbDate(from), lt: dbDate(to) } } } },
        ],
      },
      include: { assignees: { include: { member: true } }, overrides: true },
    }),
    db.member.findMany({ select: { id: true, name: true, color: true } }),
  ]);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const wanted = only ? new Set(only) : null;

  return chores.flatMap((chore) => {
    const rule = toRule(chore);
    return expandOccurrences(rule, chore.overrides.map(toOverride), from, to, today)
      .filter((occ) => !wanted || wanted.has(occ.assigneeId ?? "none"))
      .map((occ): ChoreEvent => {
        const member = occ.assigneeId ? memberById.get(occ.assigneeId) : undefined;
        const timed = rule.startTime !== null;
        return {
          id: `${rule.id}:${occ.originalDate}`,
          title: rule.title,
          start: timed ? `${occ.date}T${rule.startTime}` : occ.date,
          end: timed ? addMinutes(occ.date, rule.startTime!, rule.durationMin ?? 30) : undefined,
          allDay: !timed,
          color: member?.color ?? UNASSIGNED_COLOR,
          extendedProps: {
            choreId: rule.id,
            originalDate: occ.originalDate,
            date: occ.date,
            assigneeId: occ.assigneeId,
            assigneeName: member?.name ?? null,
            status: occ.status,
            recurring: rule.freq !== "NONE",
            moved: occ.moved,
            reassigned: occ.reassigned,
            notes: rule.notes,
            assignmentMode: rule.assignmentMode,
          },
        };
      });
  });
}

export async function getChoreForEdit(id: string) {
  const chore = await db.chore.findUnique({
    where: { id },
    include: { assignees: { include: { member: true } } },
  });
  return chore ? toRule(chore) : null;
}
