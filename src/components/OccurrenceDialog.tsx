"use client";

import { useState } from "react";
import type { ChoreEventProps, MemberDTO } from "@/lib/events";
import { formatDate } from "@/lib/client-dates";
import {
  ErrorText,
  Modal,
  buttonClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
} from "./Modal";

export type Scope = "occurrence" | "series";

type Step = "view" | "edit-scope" | "delete-scope" | "edit-occurrence";

const STATUS_LABEL = { done: "Done", overdue: "Overdue", upcoming: "Upcoming" } as const;

export function OccurrenceDialog({
  occurrence,
  title,
  members,
  onClose,
  onToggleDone,
  onEditSeries,
  onEditOccurrence,
  onDelete,
}: {
  occurrence: ChoreEventProps;
  title: string;
  members: MemberDTO[];
  onClose: () => void;
  onToggleDone: (done: boolean) => Promise<string | null>;
  onEditSeries: () => void;
  onEditOccurrence: (date: string, memberId: string | null) => Promise<string | null>;
  onDelete: (scope: Scope) => Promise<string | null>;
}) {
  const [step, setStep] = useState<Step>("view");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(occurrence.date);
  const [memberId, setMemberId] = useState<string>(
    occurrence.reassigned ? (occurrence.assigneeId ?? "") : "",
  );

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(await action());
    setBusy(false);
  };

  const done = occurrence.status === "done";

  const scopeButtons = (onPick: (scope: Scope) => void, verb: string) => (
    <div className="space-y-3">
      <p className="text-sm">This chore repeats. What do you want to {verb.toLowerCase()}?</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => onPick("occurrence")}
        >
          {verb} only this one ({formatDate(occurrence.date)})
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => onPick("series")}
        >
          {verb} the whole series
        </button>
      </div>
      <div className="flex justify-end">
        <button type="button" className={buttonClass} onClick={() => setStep("view")}>
          Back
        </button>
      </div>
    </div>
  );

  return (
    <Modal open title={title} onClose={onClose}>
      {step === "view" && (
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Date</dt>
            <dd>
              {formatDate(occurrence.date)}
              {occurrence.moved && <span className="text-muted"> (moved)</span>}
            </dd>
            <dt className="text-muted">Who</dt>
            <dd>
              {occurrence.assigneeName ?? "Unassigned"}
              {occurrence.assignmentMode === "ROTATING" && (
                <span className="text-muted"> (rotation)</span>
              )}
            </dd>
            <dt className="text-muted">Status</dt>
            <dd className={occurrence.status === "overdue" ? "font-medium text-overdue" : ""}>
              {STATUS_LABEL[occurrence.status]}
            </dd>
            {occurrence.recurring && (
              <>
                <dt className="text-muted">Repeats</dt>
                <dd>Yes</dd>
              </>
            )}
            {occurrence.notes && (
              <>
                <dt className="text-muted">Notes</dt>
                <dd className="whitespace-pre-wrap">{occurrence.notes}</dd>
              </>
            )}
          </dl>

          <label className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={done}
              disabled={busy}
              onChange={(e) => run(() => onToggleDone(e.target.checked))}
              className="size-4"
            />
            Done
          </label>

          <ErrorText message={error} />

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={dangerButtonClass}
              disabled={busy}
              onClick={() =>
                occurrence.recurring ? setStep("delete-scope") : run(() => onDelete("series"))
              }
            >
              Delete
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={busy}
              onClick={() => (occurrence.recurring ? setStep("edit-scope") : onEditSeries())}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {step === "edit-scope" &&
        scopeButtons(
          (scope) => (scope === "series" ? onEditSeries() : setStep("edit-occurrence")),
          "Edit",
        )}

      {step === "delete-scope" && (
        <>
          {scopeButtons((scope) => run(() => onDelete(scope)), "Delete")}
          <ErrorText message={error} />
        </>
      )}

      {step === "edit-occurrence" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => onEditOccurrence(date, memberId || null));
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Date</span>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Who</span>
            <select
              className={inputClass}
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">As scheduled by the series</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <ErrorText message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setStep("view")}>
              Back
            </button>
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              Save this occurrence
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
