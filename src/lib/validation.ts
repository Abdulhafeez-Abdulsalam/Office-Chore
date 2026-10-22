import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const memberInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
});

export const choreInput = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(100),
    notes: z.string().trim().max(1000).nullable(),
    startDate: isoDate,
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
      .nullable(),
    durationMin: z.number().int().min(5).max(1440).nullable(),
    freq: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]),
    interval: z.number().int().min(1).max(99),
    byWeekday: z.array(z.number().int().min(0).max(6)).max(7),
    untilDate: isoDate.nullable(),
    assignmentMode: z.enum(["FIXED", "ROTATING"]),
    assigneeIds: z.array(z.string().min(1)).max(50),
  })
  .refine((c) => !c.untilDate || c.untilDate >= c.startDate, {
    message: "End date must be on or after the start date",
    path: ["untilDate"],
  })
  .refine((c) => c.assignmentMode === "ROTATING" || c.assigneeIds.length <= 1, {
    message: "A fixed chore has at most one person",
    path: ["assigneeIds"],
  })
  .refine((c) => new Set(c.assigneeIds).size === c.assigneeIds.length, {
    message: "Each person can appear once in a rotation",
    path: ["assigneeIds"],
  });

export type ChoreInput = z.infer<typeof choreInput>;

export const occurrenceEdit = z.object({
  date: isoDate,
  memberId: z.string().min(1).nullable(),
});

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
