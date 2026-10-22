/** Calendar date in "YYYY-MM-DD" form, with no time zone attached. */
export type ISODate = string;

export type Frequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
export type AssignmentMode = "FIXED" | "ROTATING";

export interface ChoreRule {
  id: string;
  title: string;
  notes: string | null;
  startDate: ISODate;
  startTime: string | null;
  durationMin: number | null;
  freq: Frequency;
  interval: number;
  /** 0 = Monday … 6 = Sunday. */
  byWeekday: number[];
  untilDate: ISODate | null;
  assignmentMode: AssignmentMode;
  /** Active members only, in rotation order. */
  assigneeIds: string[];
}

export interface Override {
  originalDate: ISODate;
  skipped: boolean;
  overrideDate: ISODate | null;
  overrideMemberId: string | null;
  doneAt: Date | null;
  doneAssigneeId: string | null;
}

export type OccurrenceStatus = "done" | "overdue" | "upcoming";

export interface Occurrence {
  choreId: string;
  originalDate: ISODate;
  date: ISODate;
  assigneeId: string | null;
  status: OccurrenceStatus;
  /** Position in the series; -1 for a completed occurrence the current rule no longer produces. */
  index: number;
  moved: boolean;
  /** True when this one occurrence was given to someone other than the series' pick. */
  reassigned: boolean;
}
