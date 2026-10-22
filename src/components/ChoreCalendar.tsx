"use client";

import { useCallback, useImperativeHandle, useRef, type Ref } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { EventContentArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import type { ChoreEvent, ChoreEventProps } from "@/lib/events";
import { localToday } from "@/lib/client-dates";

export interface CalendarHandle {
  refetch(): void;
}

function renderEvent(arg: EventContentArg) {
  const props = arg.event.extendedProps as ChoreEventProps;
  const time = arg.timeText && !arg.event.allDay ? `${arg.timeText} ` : "";
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden px-1 text-xs leading-5">
      {props.status === "done" && <span aria-label="Done">✓</span>}
      {props.status === "overdue" && (
        <span aria-label="Overdue" title="Overdue">
          !
        </span>
      )}
      <span className="truncate">
        {time}
        <span className="chore-title font-medium">{arg.event.title}</span>
        {props.assigneeName ? ` · ${props.assigneeName}` : " · Unassigned"}
      </span>
    </div>
  );
}

export function ChoreCalendar({
  ref,
  firstDay,
  only,
  onCreate,
  onSelect,
  onError,
}: {
  ref: Ref<CalendarHandle>;
  firstDay: number;
  only: string[] | null;
  onCreate: (date: string, time: string | null) => void;
  onSelect: (props: ChoreEventProps, title: string) => void;
  onError: (message: string) => void;
}) {
  const calendar = useRef<FullCalendar>(null);
  useImperativeHandle(ref, () => ({
    refetch: () => calendar.current?.getApi().refetchEvents(),
  }));

  const onlyKey = only?.join(",") ?? null;
  const fetchEvents = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      const params = new URLSearchParams({
        from: info.startStr.slice(0, 10),
        to: info.endStr.slice(0, 10),
        today: localToday(),
      });
      if (onlyKey !== null) params.set("only", onlyKey);
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) {
        onError("Couldn't load chores. Check your connection and try again.");
        return [];
      }
      const events = (await res.json()) as ChoreEvent[];
      return events;
    },
    [onlyKey, onError],
  );

  const handleDateClick = (arg: DateClickArg) => {
    const [date, rest] = arg.dateStr.split("T");
    onCreate(date, arg.allDay || !rest ? null : rest.slice(0, 5));
  };

  return (
    <FullCalendar
      ref={calendar}
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "timeGridWeek,dayGridMonth",
      }}
      buttonText={{ today: "Today", week: "Week", month: "Month" }}
      firstDay={firstDay}
      height="100%"
      nowIndicator
      allDayText="All day"
      slotMinTime="06:00:00"
      slotMaxTime="22:00:00"
      scrollTime="08:00:00"
      dayMaxEvents
      eventDisplay="block"
      events={fetchEvents}
      eventContent={renderEvent}
      eventClassNames={(arg) => [`chore-${(arg.event.extendedProps as ChoreEventProps).status}`]}
      dateClick={handleDateClick}
      eventClick={(arg) => onSelect(arg.event.extendedProps as ChoreEventProps, arg.event.title)}
    />
  );
}
