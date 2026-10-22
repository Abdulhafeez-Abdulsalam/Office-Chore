import type { AssignmentMode, ISODate, OccurrenceStatus } from "@/lib/schedule";

export const UNASSIGNED_COLOR = "#8a8f98";

export interface MemberDTO {
  id: string;
  name: string;
  color: string;
}

export interface ChoreEventProps {
  choreId: string;
  originalDate: ISODate;
  date: ISODate;
  assigneeId: string | null;
  assigneeName: string | null;
  status: OccurrenceStatus;
  recurring: boolean;
  moved: boolean;
  reassigned: boolean;
  notes: string | null;
  assignmentMode: AssignmentMode;
}

/** The shape FullCalendar consumes. */
export interface ChoreEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  color: string;
  extendedProps: ChoreEventProps;
}
