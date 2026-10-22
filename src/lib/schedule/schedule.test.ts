import { describe, expect, it } from "vitest";
import {
  expandOccurrences,
  findOccurrence,
  previewRemoval,
  seriesDates,
  staleOverrides,
  withoutMember,
  type ChoreRule,
  type Override,
} from ".";

function rule(partial: Partial<ChoreRule>): ChoreRule {
  return {
    id: "c1",
    title: "Dishes",
    notes: null,
    startDate: "2026-01-05", // a Monday
    startTime: null,
    durationMin: null,
    freq: "NONE",
    interval: 1,
    byWeekday: [],
    untilDate: null,
    assignmentMode: "FIXED",
    assigneeIds: ["alice"],
    ...partial,
  };
}

function override(partial: Partial<Override> & { originalDate: string }): Override {
  return {
    skipped: false,
    overrideDate: null,
    overrideMemberId: null,
    doneAt: null,
    doneAssigneeId: null,
    ...partial,
  };
}

const dates = (r: ChoreRule, from: string, to: string, overrides: Override[] = []) =>
  expandOccurrences(r, overrides, from, to, "2026-01-01").map((o) => o.date);

describe("seriesDates", () => {
  it("returns just the start date for a one-off chore", () => {
    expect(seriesDates(rule({}), "2026-12-31")).toEqual(["2026-01-05"]);
  });

  it("repeats daily and every N days", () => {
    expect(seriesDates(rule({ freq: "DAILY" }), "2026-01-08")).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
    ]);
    expect(seriesDates(rule({ freq: "DAILY", interval: 3 }), "2026-01-15")).toEqual([
      "2026-01-05",
      "2026-01-08",
      "2026-01-11",
      "2026-01-14",
    ]);
  });

  it("repeats weekly on chosen weekdays", () => {
    // Monday and Thursday
    expect(seriesDates(rule({ freq: "WEEKLY", byWeekday: [0, 3] }), "2026-01-16")).toEqual([
      "2026-01-05",
      "2026-01-08",
      "2026-01-12",
      "2026-01-15",
    ]);
  });

  it("repeats every other week", () => {
    expect(
      seriesDates(rule({ freq: "WEEKLY", interval: 2, byWeekday: [4] }), "2026-02-01"),
    ).toEqual(["2026-01-09", "2026-01-23"]);
  });

  it("defaults a weekly rule with no weekdays to the start date's weekday", () => {
    expect(seriesDates(rule({ freq: "WEEKLY" }), "2026-01-20")).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
    ]);
  });

  it("skips months that lack the start day", () => {
    expect(seriesDates(rule({ freq: "MONTHLY", startDate: "2026-01-31" }), "2026-06-01")).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
    ]);
  });

  it("stops at the end date, inclusive", () => {
    expect(seriesDates(rule({ freq: "DAILY", untilDate: "2026-01-07" }), "2026-02-01")).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
    ]);
  });
});

describe("expandOccurrences", () => {
  it("only returns occurrences inside the half-open range", () => {
    expect(dates(rule({ freq: "DAILY" }), "2026-01-06", "2026-01-08")).toEqual([
      "2026-01-06",
      "2026-01-07",
    ]);
  });

  it("rotates assignees in order", () => {
    const r = rule({ freq: "WEEKLY", assignmentMode: "ROTATING", assigneeIds: ["a", "b", "c"] });
    const people = expandOccurrences(r, [], "2026-01-01", "2026-02-10", "2026-01-01").map(
      (o) => o.assigneeId,
    );
    expect(people).toEqual(["a", "b", "c", "a", "b", "c"]);
  });

  it("keeps the rotation stable when an occurrence is skipped", () => {
    const r = rule({ freq: "WEEKLY", assignmentMode: "ROTATING", assigneeIds: ["a", "b"] });
    const occ = expandOccurrences(
      r,
      [override({ originalDate: "2026-01-12", skipped: true })],
      "2026-01-01",
      "2026-01-27",
      "2026-01-01",
    );
    expect(occ.map((o) => [o.date, o.assigneeId])).toEqual([
      ["2026-01-05", "a"],
      ["2026-01-19", "a"],
      ["2026-01-26", "b"],
    ]);
  });

  it("applies a one-off reassignment", () => {
    const r = rule({ freq: "DAILY" });
    const [occ] = expandOccurrences(
      r,
      [override({ originalDate: "2026-01-05", overrideMemberId: "bob" })],
      "2026-01-05",
      "2026-01-06",
      "2026-01-01",
    );
    expect(occ.assigneeId).toBe("bob");
  });

  it("shows a moved occurrence on its new date, including when moved in from outside the range", () => {
    const r = rule({ freq: "WEEKLY" });
    const moved = [override({ originalDate: "2026-01-19", overrideDate: "2026-01-09" })];
    const occ = expandOccurrences(r, moved, "2026-01-05", "2026-01-12", "2026-01-01");
    expect(occ.map((o) => [o.originalDate, o.date, o.moved])).toEqual([
      ["2026-01-05", "2026-01-05", false],
      ["2026-01-19", "2026-01-09", true],
    ]);
    expect(dates(r, "2026-01-19", "2026-01-20", moved)).toEqual([]);
  });

  it("marks status as done, overdue or upcoming relative to today", () => {
    const r = rule({ freq: "DAILY" });
    const occ = expandOccurrences(
      r,
      [override({ originalDate: "2026-01-05", doneAt: new Date(), doneAssigneeId: "alice" })],
      "2026-01-05",
      "2026-01-08",
      "2026-01-07",
    );
    expect(occ.map((o) => o.status)).toEqual(["done", "overdue", "upcoming"]);
  });

  it("keeps a completed occurrence's assignee after the rotation changes", () => {
    const before = rule({ freq: "WEEKLY", assignmentMode: "ROTATING", assigneeIds: ["a", "b"] });
    const done = [
      override({ originalDate: "2026-01-12", doneAt: new Date(), doneAssigneeId: "b" }),
    ];
    const after = { ...before, assigneeIds: ["a", "c", "d"] };
    const occ = expandOccurrences(after, done, "2026-01-12", "2026-01-13", "2026-01-20");
    expect(occ[0].assigneeId).toBe("b");
  });

  it("keeps completed history that a series edit no longer produces", () => {
    const r = rule({ freq: "WEEKLY", byWeekday: [1] }); // moved from Mondays to Tuesdays
    const done = [
      override({ originalDate: "2026-01-05", doneAt: new Date(), doneAssigneeId: "alice" }),
    ];
    const occ = expandOccurrences(r, done, "2026-01-05", "2026-01-07", "2026-01-10");
    expect(occ.map((o) => [o.date, o.status, o.index])).toEqual([
      ["2026-01-05", "done", -1],
      ["2026-01-06", "overdue", 0],
    ]);
  });

  it("leaves unassigned when there are no assignees", () => {
    const [occ] = expandOccurrences(
      rule({ assigneeIds: [] }),
      [],
      "2026-01-01",
      "2026-02-01",
      "2026-01-01",
    );
    expect(occ.assigneeId).toBeNull();
  });
});

describe("findOccurrence", () => {
  it("finds an occurrence by its original date with the right rotation slot", () => {
    const r = rule({ freq: "WEEKLY", assignmentMode: "ROTATING", assigneeIds: ["a", "b"] });
    expect(findOccurrence(r, [], "2026-01-12", "2026-01-01")?.assigneeId).toBe("b");
  });

  it("returns null for a date the series does not produce", () => {
    expect(findOccurrence(rule({ freq: "WEEKLY" }), [], "2026-01-06", "2026-01-01")).toBeNull();
  });
});

describe("staleOverrides", () => {
  it("drops overrides for dates no longer in the series, but keeps completed ones", () => {
    const r = rule({ freq: "WEEKLY", byWeekday: [1] });
    const overrides = [
      override({ originalDate: "2026-01-05", skipped: true }),
      override({ originalDate: "2026-01-12", doneAt: new Date() }),
      override({ originalDate: "2026-01-13", overrideMemberId: "bob" }),
    ];
    expect(staleOverrides(r, overrides).map((o) => o.originalDate)).toEqual(["2026-01-05"]);
  });
});

describe("member removal", () => {
  const rules = [
    rule({ id: "fixed", title: "Plants", assigneeIds: ["alice"] }),
    rule({ id: "rot", title: "Dishes", assignmentMode: "ROTATING", assigneeIds: ["alice", "bob"] }),
    rule({ id: "other", title: "Trash", assigneeIds: ["bob"] }),
  ];

  it("previews which chores lose an assignee and which rotations shrink", () => {
    expect(previewRemoval("alice", rules)).toEqual([
      { choreId: "fixed", title: "Plants", effect: "unassigned" },
      { choreId: "rot", title: "Dishes", effect: "rotation-shrinks" },
    ]);
  });

  it("leaves fixed chores unassigned and rotations without the member", () => {
    expect(withoutMember(rules[0], "alice").assigneeIds).toEqual([]);
    const shrunk = withoutMember({ ...rules[1], freq: "WEEKLY" }, "alice");
    expect(
      expandOccurrences(shrunk, [], "2026-01-01", "2026-01-13", "2026-01-01").map(
        (o) => o.assigneeId,
      ),
    ).toEqual(["bob", "bob"]);
  });
});
