"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChoreEventProps, MemberDTO } from "@/lib/events";
import type { ActionResult, ChoreInput } from "@/lib/validation";
import { localToday } from "@/lib/client-dates";
import {
  addMember,
  createChore,
  deleteChore,
  deleteOccurrence,
  editOccurrence,
  loadChore,
  previewMemberRemoval,
  removeMember,
  setOccurrenceDone,
  updateChoreSeries,
} from "@/server/actions";
import { ChoreCalendar, type CalendarHandle } from "./ChoreCalendar";
import { ChoreDialog, type ChoreDialogState } from "./ChoreDialog";
import { OccurrenceDialog } from "./OccurrenceDialog";
import { TeamPanel } from "./TeamPanel";
import { buttonClass, primaryButtonClass } from "./Modal";

const WEEK_START_KEY = "chores.firstDay";
const UNASSIGNED = "none";

function readFirstDay(): number {
  try {
    const value = Number(window.localStorage.getItem(WEEK_START_KEY));
    return value >= 0 && value <= 6 ? value : 0;
  } catch {
    return 0;
  }
}

const errorOf = (result: ActionResult<unknown>) => (result.ok ? null : result.error);

export function ChoreApp({ members }: { members: MemberDTO[] }) {
  const calendar = useRef<CalendarHandle>(null);
  const [firstDay, setFirstDay] = useState(0);
  const [only, setOnly] = useState<string[] | null>(null);
  const [choreDialog, setChoreDialog] = useState<ChoreDialogState | null>(null);
  const [selected, setSelected] = useState<{ props: ChoreEventProps; title: string } | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => setFirstDay(readFirstDay()), []);

  const changeFirstDay = (value: number) => {
    setFirstDay(value);
    try {
      window.localStorage.setItem(WEEK_START_KEY, String(value));
    } catch {
      // Preference just won't persist.
    }
  };

  const refresh = () => calendar.current?.refetch();
  const onError = useCallback((message: string) => setBanner(message), []);

  /** Runs an action; on success closes dialogs and refreshes the calendar. */
  const mutate = async (action: () => Promise<ActionResult<unknown>>, after?: () => void) => {
    try {
      const message = errorOf(await action());
      if (!message) {
        after?.();
        refresh();
      }
      return message;
    } catch {
      return "Something went wrong. Please try again.";
    }
  };

  const toggleFilter = (id: string) => {
    const current = only ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setOnly(next.length === 0 ? null : next);
  };

  const saveChore = (input: ChoreInput) => {
    const state = choreDialog;
    if (!state) return Promise.resolve(null);
    return mutate(
      () =>
        state.mode === "create" ? createChore(input) : updateChoreSeries(state.rule.id, input),
      () => setChoreDialog(null),
    );
  };

  const editSeries = async (choreId: string) => {
    const result = await loadChore(choreId);
    setSelected(null);
    if (result.ok) setChoreDialog({ mode: "edit", rule: result.data });
    else {
      setBanner(result.error);
      refresh();
    }
  };

  const chip = (id: string | null, label: string, color?: string) => {
    const active = id === null ? only === null : (only?.includes(id) ?? false);
    return (
      <button
        key={id ?? "all"}
        type="button"
        aria-pressed={active}
        onClick={() => (id === null ? setOnly(null) : toggleFilter(id))}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${active ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg"}`}
      >
        {color && (
          <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
        )}
        {label}
      </button>
    );
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <h1 className="mr-2 text-lg font-semibold">Office Chores</h1>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() =>
            setChoreDialog({ mode: "create", startDate: localToday(), startTime: null })
          }
        >
          + New chore
        </button>
        <nav
          aria-label="Filter by person"
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5"
        >
          {chip(null, "Everyone")}
          {members.map((m) => chip(m.id, m.name, m.color))}
          {chip(UNASSIGNED, "Unassigned", "#8a8f98")}
        </nav>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Week starts
          <select
            className="rounded border border-line bg-surface px-1.5 py-1 text-xs text-fg"
            value={firstDay}
            onChange={(e) => changeFirstDay(Number(e.target.value))}
          >
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
            <option value={6}>Saturday</option>
          </select>
        </label>
        <button
          type="button"
          className={`${buttonClass} lg:hidden`}
          aria-expanded={teamOpen}
          aria-controls="team-panel"
          onClick={() => setTeamOpen((o) => !o)}
        >
          Team
        </button>
      </header>

      {banner && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-danger/10 px-4 py-2 text-sm text-danger"
        >
          {banner}
          <button type="button" className="underline" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 bg-surface p-3">
          <ChoreCalendar
            ref={calendar}
            firstDay={firstDay}
            only={only}
            onError={onError}
            onCreate={(startDate, startTime) =>
              setChoreDialog({ mode: "create", startDate, startTime })
            }
            onSelect={(props, title) => setSelected({ props, title })}
          />
        </main>
        <aside
          id="team-panel"
          className={`${teamOpen ? "block" : "hidden"} absolute inset-y-0 right-0 z-10 w-full overflow-y-auto border-l border-line bg-surface p-4 shadow-xl sm:w-72 lg:static lg:block lg:shrink-0 lg:shadow-none`}
        >
          <TeamPanel
            members={members}
            onAdd={(name, color) => mutate(() => addMember({ name, color }))}
            onPreviewRemoval={async (id) => {
              const result = await previewMemberRemoval(id);
              return result.ok ? result.data : result.error;
            }}
            onRemove={(id) => mutate(() => removeMember(id, localToday()))}
          />
        </aside>
      </div>

      {choreDialog && (
        <ChoreDialog
          key={choreDialog.mode === "edit" ? choreDialog.rule.id : "new"}
          state={choreDialog}
          members={members}
          firstDay={firstDay}
          onClose={() => setChoreDialog(null)}
          onSubmit={saveChore}
        />
      )}

      {selected && (
        <OccurrenceDialog
          key={`${selected.props.choreId}:${selected.props.originalDate}`}
          occurrence={selected.props}
          title={selected.title}
          members={members}
          onClose={() => setSelected(null)}
          onToggleDone={(done) =>
            mutate(
              () =>
                setOccurrenceDone(
                  selected.props.choreId,
                  selected.props.originalDate,
                  done,
                  localToday(),
                ),
              () => setSelected(null),
            )
          }
          onEditSeries={() => editSeries(selected.props.choreId)}
          onEditOccurrence={(date, memberId) =>
            mutate(
              () =>
                editOccurrence(
                  selected.props.choreId,
                  selected.props.originalDate,
                  { date, memberId },
                  localToday(),
                ),
              () => setSelected(null),
            )
          }
          onDelete={(scope) =>
            mutate(
              () =>
                scope === "series"
                  ? deleteChore(selected.props.choreId)
                  : deleteOccurrence(
                      selected.props.choreId,
                      selected.props.originalDate,
                      localToday(),
                    ),
              () => setSelected(null),
            )
          }
        />
      )}
    </div>
  );
}
