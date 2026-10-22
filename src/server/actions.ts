"use server";

import { revalidatePath } from "next/cache";
import {
  findOccurrence,
  previewRemoval,
  staleOverrides,
  type ChoreRule,
  type ISODate,
  type RemovalImpact,
} from "@/lib/schedule";
import {
  choreInput,
  firstError,
  isoDate,
  memberInput,
  occurrenceEdit,
  type ActionResult,
  type ChoreInput,
} from "@/lib/validation";
import type { MemberDTO } from "@/lib/events";
import { db } from "./db";
import { dbDate, toOverride, toRule } from "./mappers";
import { getChoreForEdit } from "./queries";

const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

async function activeMemberIds(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const count = await db.member.count({ where: { id: { in: ids }, deletedAt: null } });
  return count === ids.length;
}

function choreData(input: ChoreInput) {
  return {
    title: input.title,
    notes: input.notes || null,
    startDate: dbDate(input.startDate),
    startTime: input.startTime,
    durationMin: input.startTime ? (input.durationMin ?? 30) : null,
    freq: input.freq,
    interval: input.interval,
    byWeekday: input.freq === "WEEKLY" ? [...new Set(input.byWeekday)].sort() : [],
    untilDate: input.freq !== "NONE" && input.untilDate ? dbDate(input.untilDate) : null,
    assignmentMode: input.assignmentMode,
  };
}

const assigneeRows = (ids: string[]) => ids.map((memberId, position) => ({ memberId, position }));

// Members

export async function addMember(raw: unknown): Promise<ActionResult<MemberDTO>> {
  const parsed = memberInput.safeParse(raw);
  if (!parsed.success) return fail(firstError(parsed.error));
  const member = await db.member.create({
    data: parsed.data,
    select: { id: true, name: true, color: true },
  });
  revalidatePath("/");
  return ok(member);
}

export async function previewMemberRemoval(
  memberId: string,
): Promise<ActionResult<RemovalImpact[]>> {
  const chores = await db.chore.findMany({
    where: { assignees: { some: { memberId } } },
    include: { assignees: { include: { member: true } } },
    orderBy: { title: "asc" },
  });
  return ok(previewRemoval(memberId, chores.map(toRule)));
}

export async function removeMember(memberId: string, today: ISODate): Promise<ActionResult> {
  if (!isoDate.safeParse(today).success) return fail("Invalid date");
  await db.$transaction([
    db.choreAssignee.deleteMany({ where: { memberId } }),
    db.occurrenceOverride.updateMany({
      where: { overrideMemberId: memberId, doneAt: null, originalDate: { gte: dbDate(today) } },
      data: { overrideMemberId: null },
    }),
    db.member.update({ where: { id: memberId }, data: { deletedAt: new Date() } }),
  ]);
  revalidatePath("/");
  return ok(undefined);
}

// Chores

export async function loadChore(id: string): Promise<ActionResult<ChoreRule>> {
  const rule = await getChoreForEdit(id);
  return rule ? ok(rule) : fail("That chore no longer exists");
}

export async function createChore(raw: unknown): Promise<ActionResult> {
  const parsed = choreInput.safeParse(raw);
  if (!parsed.success) return fail(firstError(parsed.error));
  if (!(await activeMemberIds(parsed.data.assigneeIds)))
    return fail("Someone in the list was removed");
  await db.chore.create({
    data: {
      ...choreData(parsed.data),
      assignees: { create: assigneeRows(parsed.data.assigneeIds) },
    },
  });
  return ok(undefined);
}

export async function updateChoreSeries(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = choreInput.safeParse(raw);
  if (!parsed.success) return fail(firstError(parsed.error));
  if (!(await activeMemberIds(parsed.data.assigneeIds)))
    return fail("Someone in the list was removed");

  const updated = await db.$transaction(async (tx) => {
    const exists = await tx.chore.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return null;
    await tx.choreAssignee.deleteMany({ where: { choreId: id } });
    const chore = await tx.chore.update({
      where: { id },
      data: {
        ...choreData(parsed.data),
        assignees: { create: assigneeRows(parsed.data.assigneeIds) },
      },
      include: { assignees: { include: { member: true } }, overrides: true },
    });
    const stale = staleOverrides(toRule(chore), chore.overrides.map(toOverride));
    if (stale.length > 0) {
      await tx.occurrenceOverride.deleteMany({
        where: { choreId: id, originalDate: { in: stale.map((o) => dbDate(o.originalDate)) } },
      });
    }
    return chore;
  });
  return updated ? ok(undefined) : fail("That chore no longer exists");
}

export async function deleteChore(id: string): Promise<ActionResult> {
  await db.chore.deleteMany({ where: { id } });
  return ok(undefined);
}

// Single occurrences

async function loadForOccurrence(choreId: string, originalDate: ISODate, today: ISODate) {
  if (!isoDate.safeParse(originalDate).success || !isoDate.safeParse(today).success) return null;
  const chore = await db.chore.findUnique({
    where: { id: choreId },
    include: { assignees: { include: { member: true } }, overrides: true },
  });
  if (!chore) return null;
  const occurrence = findOccurrence(
    toRule(chore),
    chore.overrides.map(toOverride),
    originalDate,
    today,
  );
  return occurrence ? { chore, occurrence } : null;
}

function upsertOverride(
  choreId: string,
  originalDate: ISODate,
  data: {
    skipped?: boolean;
    overrideDate?: Date | null;
    overrideMemberId?: string | null;
    doneAt?: Date | null;
    doneAssigneeId?: string | null;
  },
) {
  const key = { choreId_originalDate: { choreId, originalDate: dbDate(originalDate) } };
  return db.occurrenceOverride.upsert({
    where: key,
    update: data,
    create: { choreId, originalDate: dbDate(originalDate), ...data },
  });
}

export async function setOccurrenceDone(
  choreId: string,
  originalDate: ISODate,
  done: boolean,
  today: ISODate,
): Promise<ActionResult> {
  const found = await loadForOccurrence(choreId, originalDate, today);
  if (!found) return fail("That occurrence no longer exists");
  await upsertOverride(
    choreId,
    originalDate,
    done
      ? { doneAt: new Date(), doneAssigneeId: found.occurrence.assigneeId }
      : { doneAt: null, doneAssigneeId: null },
  );
  return ok(undefined);
}

export async function editOccurrence(
  choreId: string,
  originalDate: ISODate,
  raw: unknown,
  today: ISODate,
): Promise<ActionResult> {
  const parsed = occurrenceEdit.safeParse(raw);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { date, memberId } = parsed.data;
  if (memberId && !(await activeMemberIds([memberId]))) return fail("That person was removed");
  if (!(await loadForOccurrence(choreId, originalDate, today))) {
    return fail("That occurrence no longer exists");
  }
  await upsertOverride(choreId, originalDate, {
    overrideDate: date === originalDate ? null : dbDate(date),
    overrideMemberId: memberId,
  });
  return ok(undefined);
}

export async function deleteOccurrence(
  choreId: string,
  originalDate: ISODate,
  today: ISODate,
): Promise<ActionResult> {
  if (!(await loadForOccurrence(choreId, originalDate, today))) {
    return fail("That occurrence no longer exists");
  }
  await upsertOverride(choreId, originalDate, { skipped: true });
  return ok(undefined);
}
