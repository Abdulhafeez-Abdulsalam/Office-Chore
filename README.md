# Office Chores

A shared calendar for office chores. See who's on duty in an Outlook-style **Week** or **Month** view, add one-off or recurring chores, assign them to one person or a rotation, tick them off, and manage the team.

## Features

- **Calendar:** Week (time grid) and Month views, Today/previous/next, and a configurable first day of the week (stored per browser).
- **Chores:** all-day or timed (with a duration), plus optional notes. Click an empty day or slot to create one there.
- **Recurrence:** daily, weekly on chosen weekdays, or monthly on a date, every _N_ days/weeks/months, with an optional end date. Monthly chores on the 29th–31st skip months without that day.
- **Assignment:** one person, or **take turns** through an ordered rotation. Skipped occurrences still use up a turn, so the rotation doesn't shift.
- **Editing a repeating chore:** change or delete _just this occurrence_ (move its date or give it to someone else) or _the whole series_.
- **Done / overdue:** tick off each occurrence; past ones that weren't done are flagged as overdue. A completed occurrence keeps the name of whoever was on duty, even if the rotation changes later.
- **Team:** add members with a colour; removing someone shows which chores are affected first. Their future chores become unassigned (or the rotation skips them), and their completed history is kept.
- **Filter** the calendar by person, or show only unassigned chores.

> **No login.** Anyone with the URL can view and edit everything. Share the link only inside the office. Adding a shared passcode would be a small follow-up if that becomes a concern.

## Tech stack

Next.js 15 (App Router, server actions) · React 19 · TypeScript · Prisma 6 + PostgreSQL · FullCalendar 6 · rrule · Tailwind CSS 4 · Vitest · Playwright.

```
src/
  app/                 page, layout, /api/events route (calendar feed)
  components/          ChoreApp, ChoreCalendar, ChoreDialog, OccurrenceDialog, TeamPanel, Modal
  lib/schedule/        pure recurrence + rotation logic (no DB) and its unit tests
  lib/validation.ts    zod schemas shared by forms and server actions
  server/              Prisma client, queries, server actions
prisma/                schema and migrations
e2e/                   Playwright end-to-end tests
```

### How occurrences work

A chore is stored once, as a rule. Occurrences are calculated on the fly for the visible date range (`src/lib/schedule/expand.ts`). Only occurrences that differ from the rule get a row in `OccurrenceOverride`: skipped, moved, reassigned or completed. Dates are plain calendar dates and times are office wall-clock times, with no time-zone conversion. "Today" (used for overdue) comes from the viewer's browser.

## Local development

Requirements: Node 20+ and Docker.

```bash
docker compose up -d          # Postgres on localhost:5432
cp .env.example .env
npm install
npx prisma migrate dev        # create tables
npm run dev                   # http://localhost:3000
```

| Script                                  | What it does                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `npm test`                              | Unit tests for the scheduling logic                                              |
| `npm run test:e2e`                      | Playwright tests (needs `npm run build` first; **wipes the database** in `.env`) |
| `npm run lint` / `typecheck` / `format` | Code quality                                                                     |
| `npm run db:migrate`                    | Create a migration after editing `prisma/schema.prisma`                          |

The first time you run the end-to-end tests, install the browser with `npx playwright install chromium`.

## Deploying to Vercel (free tier)

1. Push this repository to GitHub and import it in Vercel (Hobby plan).
2. In the project, open **Storage → Create Database → Neon (Postgres)** and connect it. The free plan is enough. This sets `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used for migrations) for you.
3. Deploy. Vercel runs the `vercel-build` script, which applies migrations (`prisma migrate deploy`) and then builds the app.

CI (`.github/workflows/ci.yml`) runs lint, type-check, formatting, unit tests, a build and the Playwright tests against a throwaway Postgres on every push to `main` and every pull request.
