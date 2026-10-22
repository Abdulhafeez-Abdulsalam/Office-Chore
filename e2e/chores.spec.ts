import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

test.beforeEach(async ({ page }) => {
  await db.$executeRawUnsafe(
    'TRUNCATE "OccurrenceOverride", "ChoreAssignee", "Chore", "Member" CASCADE',
  );
  await page.goto("/");
});

test.afterAll(async () => {
  await db.$disconnect();
});

function isoDaysFromToday(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function addMember(page: Page, name: string) {
  const team = page.locator("#team-panel");
  await team.getByPlaceholder("Name").fill(name);
  await team.getByRole("button", { name: "Add member" }).click();
  await expect(team.getByRole("list", { name: "Team members" })).toContainText(name);
}

async function createChore(
  page: Page,
  opts: {
    title: string;
    startDate?: string;
    weekly?: boolean;
    rotation?: string[];
    person?: string;
  },
) {
  await page.getByRole("button", { name: "+ New chore" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(opts.title);
  if (opts.startDate) await dialog.getByLabel(/^(Date|Starts)$/).fill(opts.startDate);
  if (opts.weekly) await dialog.getByRole("combobox", { name: "Repeat" }).selectOption("WEEKLY");
  if (opts.rotation) {
    await dialog.getByLabel("Take turns").check();
    for (const name of opts.rotation) {
      const assignees = dialog.getByRole("list", { name: "Rotation order" });
      if (await assignees.getByText(name, { exact: true }).count()) continue;
      await dialog.getByLabel("Add to rotation").selectOption({ label: name });
    }
  }
  if (opts.person) await dialog.getByLabel("Assignee").selectOption({ label: opts.person });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
}

const event = (page: Page, title: string) => page.locator(".fc-event", { hasText: title });

test("a weekly rotating chore alternates people week to week and shows in month view", async ({
  page,
}) => {
  await addMember(page, "Alice");
  await addMember(page, "Bob");
  // Starting two turns back keeps this week on Alice and puts adjacent turns in any month grid.
  await createChore(page, {
    title: "Dishes",
    weekly: true,
    startDate: isoDaysFromToday(-14),
    rotation: ["Alice", "Bob"],
  });

  await expect(event(page, "Dishes")).toContainText("Alice");
  await page.locator(".fc-next-button").click();
  await expect(event(page, "Dishes")).toContainText("Bob");
  await page.locator(".fc-next-button").click();
  await expect(event(page, "Dishes")).toContainText("Alice");

  await page.locator(".fc-today-button").click();
  await page.getByRole("button", { name: "Month" }).click();
  await expect(page.locator(".fc-dayGridMonth-view")).toBeVisible();
  await expect.poll(() => event(page, "Dishes").count()).toBeGreaterThanOrEqual(2);
  await expect(event(page, "Dishes").filter({ hasText: "Alice" }).first()).toBeVisible();
  await expect(event(page, "Dishes").filter({ hasText: "Bob" }).first()).toBeVisible();
});

test("marking done, and showing missed occurrences as overdue", async ({ page }) => {
  await addMember(page, "Alice");
  await createChore(page, {
    title: "Plants",
    weekly: true,
    startDate: isoDaysFromToday(-7),
    person: "Alice",
  });

  await event(page, "Plants").click();
  await page.getByRole("dialog").getByLabel("Done").check();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(event(page, "Plants")).toHaveClass(/chore-done/);

  await page.locator(".fc-prev-button").click();
  await expect(event(page, "Plants")).toHaveClass(/chore-overdue/);
});

test("deleting one occurrence, then the whole series", async ({ page }) => {
  await addMember(page, "Alice");
  await createChore(page, { title: "Trash", weekly: true, person: "Alice" });

  await event(page, "Trash").click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: /Delete only this one/ }).click();
  await expect(event(page, "Trash")).toHaveCount(0);

  await page.locator(".fc-next-button").click();
  await event(page, "Trash").click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete the whole series" }).click();
  await expect(event(page, "Trash")).toHaveCount(0);
  await page.locator(".fc-next-button").click();
  await expect(event(page, "Trash")).toHaveCount(0);
});

test("removing a member warns and leaves their chores unassigned", async ({ page }) => {
  await addMember(page, "Alice");
  await addMember(page, "Carl");
  await createChore(page, { title: "Coffee", weekly: true, person: "Carl" });
  await expect(event(page, "Coffee")).toContainText("Carl");

  await page.getByRole("button", { name: "Remove Carl" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Coffee");
  await expect(dialog).toContainText("become unassigned");
  await dialog.getByRole("button", { name: "Remove Carl" }).click();

  await expect(page.getByRole("list", { name: "Team members" })).not.toContainText("Carl");
  await expect(event(page, "Coffee")).toContainText("Unassigned");
});
