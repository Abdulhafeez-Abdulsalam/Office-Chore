"use client";

import { useState } from "react";
import type { MemberDTO } from "@/lib/events";
import type { RemovalImpact } from "@/lib/schedule";
import {
  ErrorText,
  Modal,
  buttonClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
} from "./Modal";

export const MEMBER_COLORS = [
  "#2563eb",
  "#db2777",
  "#15803d",
  "#c2410c",
  "#7c3aed",
  "#0e7490",
  "#a16207",
  "#be123c",
  "#4338ca",
  "#047857",
];

export function TeamPanel({
  members,
  onAdd,
  onPreviewRemoval,
  onRemove,
}: {
  members: MemberDTO[];
  onAdd: (name: string, color: string) => Promise<string | null>;
  onPreviewRemoval: (id: string) => Promise<RemovalImpact[] | string>;
  onRemove: (id: string) => Promise<string | null>;
}) {
  const nextColor =
    MEMBER_COLORS.find((c) => !members.some((m) => m.color === c)) ??
    MEMBER_COLORS[members.length % MEMBER_COLORS.length];
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{ member: MemberDTO; impacts: RemovalImpact[] } | null>(
    null,
  );
  const [removeError, setRemoveError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const message = await onAdd(name, color ?? nextColor);
    setBusy(false);
    setError(message);
    if (!message) {
      setName("");
      setColor(null);
    }
  };

  const startRemoval = async (member: MemberDTO) => {
    setError(null);
    const result = await onPreviewRemoval(member.id);
    if (typeof result === "string") setError(result);
    else setRemoving({ member, impacts: result });
  };

  const confirmRemoval = async () => {
    if (!removing) return;
    setBusy(true);
    const message = await onRemove(removing.member.id);
    setBusy(false);
    setRemoveError(message);
    if (!message) setRemoving(null);
  };

  return (
    <section aria-labelledby="team-heading" className="flex h-full flex-col gap-4">
      <h2 id="team-heading" className="text-base font-semibold">
        Team
      </h2>

      {members.length === 0 ? (
        <p className="text-sm text-muted">No one yet. Add your first team member below.</p>
      ) : (
        <ul className="space-y-1" aria-label="Team members">
          {members.map((m) => (
            <li
              key={m.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: m.color }}
                aria-hidden
              />
              <span className="flex-1 truncate text-sm">{m.name}</span>
              <button
                type="button"
                onClick={() => startRemoval(m)}
                className="rounded px-1.5 text-xs text-muted hover:bg-danger/10 hover:text-danger"
                aria-label={`Remove ${m.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-2 border-t border-line pt-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Add a team member</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            maxLength={60}
            required
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
          {MEMBER_COLORS.map((c) => {
            const selected = (color ?? nextColor) === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                className={`size-6 rounded-full border-2 ${selected ? "border-fg" : "border-transparent"}`}
                style={{ background: c }}
              />
            );
          })}
        </div>
        <button type="submit" className={`${primaryButtonClass} w-full`} disabled={busy}>
          Add member
        </button>
        <ErrorText message={error} />
      </form>

      <Modal
        open={removing !== null}
        title={removing ? `Remove ${removing.member.name}?` : ""}
        onClose={() => {
          setRemoving(null);
          setRemoveError(null);
        }}
      >
        {removing && (
          <div className="space-y-4 text-sm">
            {removing.impacts.length === 0 ? (
              <p>{removing.member.name} isn&apos;t on any chores.</p>
            ) : (
              <>
                <p>
                  This affects{" "}
                  {removing.impacts.length === 1 ? "1 chore" : `${removing.impacts.length} chores`}:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {removing.impacts.map((i) => (
                    <li key={i.choreId}>
                      <span className="font-medium">{i.title}</span>{" "}
                      <span className="text-muted">
                        {i.effect === "unassigned"
                          ? "— future occurrences become unassigned"
                          : "— they're taken out of the rotation"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-muted">Chores they already completed keep their name.</p>
            <ErrorText message={removeError} />
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonClass} onClick={() => setRemoving(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={dangerButtonClass}
                disabled={busy}
                onClick={confirmRemoval}
              >
                Remove {removing.member.name}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
