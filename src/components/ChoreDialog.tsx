"use client";

import { useState } from "react";
import type { ChoreRule, Frequency } from "@/lib/schedule";
import type { MemberDTO } from "@/lib/events";
import type { ChoreInput } from "@/lib/validation";
import { ErrorText, Modal, buttonClass, inputClass, primaryButtonClass } from "./Modal";

/** Index 0 = Monday … 6 = Sunday, matching the stored rule. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const UNIT: Record<Exclude<Frequency, "NONE">, [string, string]> = {
  DAILY: ["day", "days"],
  WEEKLY: ["week", "weeks"],
  MONTHLY: ["month", "months"],
};

export type ChoreDialogState =
  | { mode: "create"; startDate: string; startTime: string | null }
  | { mode: "edit"; rule: ChoreRule };

function initialForm(state: ChoreDialogState, members: MemberDTO[]): ChoreInput {
  if (state.mode === "edit") {
    const { rule } = state;
    return {
      title: rule.title,
      notes: rule.notes,
      startDate: rule.startDate,
      startTime: rule.startTime,
      durationMin: rule.durationMin,
      freq: rule.freq,
      interval: rule.interval,
      byWeekday: rule.byWeekday,
      untilDate: rule.untilDate,
      assignmentMode: rule.assignmentMode,
      assigneeIds: rule.assigneeIds,
    };
  }
  return {
    title: "",
    notes: null,
    startDate: state.startDate,
    startTime: state.startTime,
    durationMin: state.startTime ? 30 : null,
    freq: "NONE",
    interval: 1,
    byWeekday: [],
    untilDate: null,
    assignmentMode: "FIXED",
    assigneeIds: members.length > 0 ? [members[0].id] : [],
  };
}

const jsDayToRuleDay = (jsDay: number) => (jsDay + 6) % 7;

export function ChoreDialog({
  state,
  members,
  firstDay,
  onClose,
  onSubmit,
}: {
  state: ChoreDialogState;
  members: MemberDTO[];
  firstDay: number;
  onClose: () => void;
  onSubmit: (input: ChoreInput) => Promise<string | null>;
}) {
  const [form, setForm] = useState<ChoreInput>(() => initialForm(state, members));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ChoreInput>(key: K, value: ChoreInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "Removed member";
  const notInRotation = members.filter((m) => !form.assigneeIds.includes(m.id));
  const weekdayOrder = Array.from({ length: 7 }, (_, i) => jsDayToRuleDay((firstDay + i) % 7));

  const setFreq = (freq: Frequency) => {
    setForm((f) => ({
      ...f,
      freq,
      byWeekday:
        freq === "WEEKLY" && f.byWeekday.length === 0
          ? [jsDayToRuleDay(new Date(`${f.startDate}T00:00:00`).getDay())]
          : f.byWeekday,
    }));
  };

  const toggleWeekday = (day: number) =>
    set(
      "byWeekday",
      form.byWeekday.includes(day)
        ? form.byWeekday.filter((d) => d !== day)
        : [...form.byWeekday, day],
    );

  const moveAssignee = (index: number, delta: number) => {
    const ids = [...form.assigneeIds];
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    set("assigneeIds", ids);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.freq === "WEEKLY" && form.byWeekday.length === 0) {
      setError("Pick at least one weekday");
      return;
    }
    setSaving(true);
    const message = await onSubmit({
      ...form,
      assigneeIds:
        form.assignmentMode === "FIXED" ? form.assigneeIds.slice(0, 1) : form.assigneeIds,
    });
    setSaving(false);
    setError(message);
  };

  const title = state.mode === "create" ? "New chore" : "Edit chore (whole series)";

  return (
    <Modal open title={title} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Title</span>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Empty the dishwasher"
            required
            maxLength={100}
            autoFocus
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              {form.freq === "NONE" ? "Date" : "Starts"}
            </span>
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Time</span>
            <input
              type="time"
              className={inputClass}
              value={form.startTime ?? ""}
              onChange={(e) => {
                const value = e.target.value || null;
                setForm((f) => ({
                  ...f,
                  startTime: value,
                  durationMin: value ? (f.durationMin ?? 30) : null,
                }));
              }}
              aria-describedby="time-hint"
            />
            <span id="time-hint" className="mt-0.5 block text-xs text-muted">
              Leave empty for all day
            </span>
          </label>
          {form.startTime && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Minutes</span>
              <input
                type="number"
                min={5}
                max={1440}
                step={5}
                className={inputClass}
                value={form.durationMin ?? 30}
                onChange={(e) => set("durationMin", Number(e.target.value))}
              />
            </label>
          )}
        </div>

        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-medium">Repeat</legend>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Repeat"
              className={`${inputClass} w-auto`}
              value={form.freq}
              onChange={(e) => setFreq(e.target.value as Frequency)}
            >
              <option value="NONE">Does not repeat</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            {form.freq !== "NONE" && (
              <>
                <span>every</span>
                <input
                  type="number"
                  aria-label="Interval"
                  min={1}
                  max={99}
                  className={`${inputClass} w-16`}
                  value={form.interval}
                  onChange={(e) => set("interval", Math.max(1, Number(e.target.value)))}
                />
                <span>{UNIT[form.freq][form.interval === 1 ? 0 : 1]}</span>
              </>
            )}
          </div>

          {form.freq === "WEEKLY" && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
              {weekdayOrder.map((day) => {
                const on = form.byWeekday.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleWeekday(day)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? "border-accent bg-accent text-accent-fg" : "border-line text-fg hover:bg-surface-2"}`}
                  >
                    {WEEKDAYS[day]}
                  </button>
                );
              })}
            </div>
          )}

          {form.freq === "MONTHLY" && (
            <p className="text-xs text-muted">
              Repeats on day {Number(form.startDate.slice(8, 10))} of the month; months without that
              day are skipped.
            </p>
          )}

          {form.freq !== "NONE" && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span>Ends</span>
              <input
                type="date"
                className={`${inputClass} w-auto`}
                value={form.untilDate ?? ""}
                min={form.startDate}
                onChange={(e) => set("untilDate", e.target.value || null)}
                aria-label="End date"
              />
              <span className="text-xs text-muted">optional</span>
            </label>
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-medium">Who</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="assignmentMode"
                checked={form.assignmentMode === "FIXED"}
                onChange={() => set("assignmentMode", "FIXED")}
              />
              One person
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="assignmentMode"
                checked={form.assignmentMode === "ROTATING"}
                onChange={() => set("assignmentMode", "ROTATING")}
              />
              Take turns
            </label>
          </div>

          {members.length === 0 && (
            <p className="text-xs text-muted">Add team members first to assign this chore.</p>
          )}

          {form.assignmentMode === "FIXED" && members.length > 0 && (
            <select
              aria-label="Assignee"
              className={inputClass}
              value={form.assigneeIds[0] ?? ""}
              onChange={(e) => set("assigneeIds", e.target.value ? [e.target.value] : [])}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}

          {form.assignmentMode === "ROTATING" && members.length > 0 && (
            <div className="space-y-2">
              <ol className="space-y-1" aria-label="Rotation order">
                {form.assigneeIds.map((id, i) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1 text-sm"
                  >
                    <span className="w-5 text-muted">{i + 1}.</span>
                    <span className="flex-1">{memberName(id)}</span>
                    <button
                      type="button"
                      className="px-1 text-muted hover:text-fg disabled:opacity-30"
                      aria-label={`Move ${memberName(id)} up`}
                      disabled={i === 0}
                      onClick={() => moveAssignee(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="px-1 text-muted hover:text-fg disabled:opacity-30"
                      aria-label={`Move ${memberName(id)} down`}
                      disabled={i === form.assigneeIds.length - 1}
                      onClick={() => moveAssignee(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="px-1 text-muted hover:text-danger"
                      aria-label={`Remove ${memberName(id)} from rotation`}
                      onClick={() =>
                        set(
                          "assigneeIds",
                          form.assigneeIds.filter((x) => x !== id),
                        )
                      }
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
              {notInRotation.length > 0 && (
                <select
                  aria-label="Add to rotation"
                  className={inputClass}
                  value=""
                  onChange={(e) =>
                    e.target.value && set("assigneeIds", [...form.assigneeIds, e.target.value])
                  }
                >
                  <option value="">+ Add person to rotation…</option>
                  {notInRotation.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Notes</span>
          <textarea
            className={inputClass}
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            maxLength={1000}
          />
        </label>

        <ErrorText message={error} />

        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryButtonClass} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
