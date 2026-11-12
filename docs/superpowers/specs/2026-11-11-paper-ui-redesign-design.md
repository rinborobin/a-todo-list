# Paper UI redesign

Date: 2026-11-11
Status: approved direction (user picked the Paper style and delegated the layout choice)

## Goal

Make the planner fast to reach and easy to read for a student who does not want to plan by hand.
Primary device is an iPhone; the same UI must work well on a laptop.

Success looks like:

- Opening the app shows what to do next and what is due, without navigating.
- Adding a deadline takes one line of typing, no form.
- Ticking off a block takes one tap.
- On a laptop the same screens use the extra width instead of stretching a phone layout.

## Decisions

- **Visual style: Paper.** Warm off-white background, ink-black text, one burnt-orange accent used only for
  "urgent", "overdue" and "now". Serif (Newsreader) for dates and times, Geist sans for everything else.
  A matching dark variant follows the system setting.
- **Layout: Rail** (journal page) with the next block given a large serif time.
- **Navigation:** Today, Tasks, Week, Me. Bottom tab bar below `lg`, left sidebar from `lg` up.
- **Routes:** `/today` (new home), `/tasks`, `/tasks/[id]`, `/week` (was `/planner`), `/me` (was `/availability`,
  plus timezone and account). Old URLs redirect permanently.
- **No new dependencies.** Small in-house primitives (button, fields, dialog) built on Tailwind tokens.
  Dialogs use the native `<dialog>` element. Icons stay in `src/components/ui/icons.tsx`.

## Screens

### Today

- Header: weekday, serif date, "n of m done".
- Deadlines note: up to three upcoming or overdue deadlines, accent left rule; link to all tasks.
- Rail: today's schedule items in time order on a vertical line. Done items struck through. A "now" marker sits
  between items. The next unfinished item shows a large serif start time and "in 40 min". Gaps of 15 minutes or
  more show as "30 min free". Tapping the dot marks the item done (and the task completed); tapping again undoes.
- "Replan" regenerates the plan for today through today + 6.
- Unplanned tasks: open tasks with no scheduled block, with the reason when it is known (no time estimate).
- Empty states: no free hours set (link to Me), nothing planned (button to plan the week).
- Quick-add: fixed above the tab bar on phones, top of the side column on laptops. Press `n` on a laptop to focus it.
- Laptop: two columns, rail on the left, quick-add + deadlines + unplanned on the right.

### Quick-add

- Free text such as `db essay due fri 5pm 2h`. Parsed on the client as you type, preview shown as small labelled
  values (Title, Due, Needs, Priority) before saving.
- Understands: today, tonight, tomorrow/tmr, weekday names (next occurrence), `next <weekday>`, `13 nov`/`nov 13`,
  `in 3 days`, times like `5pm`, `5:30pm`, `17:00`, durations like `2h`, `90m`, `1h30`, `1.5h`, priority `!` (high),
  `!!` or `urgent` (urgent). Connector words `due`, `by`, `at`, `on` are dropped.
- A date without a time means 23:59 that day. A time without a date means today, or tomorrow if already past.
- No duration typed means 1 hour, shown as "1h (default)".
- After saving, the week (today to today + 6) is replanned and the result is reported:
  "Planned Thu 14:00" or "Added, not planned: <reason>".

### Tasks

- Search, "New task" button, filter Open / Done / All.
- Open tasks grouped: Overdue, Due in the next 7 days, Later, No deadline. Rows: tick circle, title, one meta line
  (due countdown, duration, priority only when High or Urgent).
- Detail page and create/edit dialog restyled with the shared primitives.

### Week

- Today to today + 6 by default, adjustable range. "Plan week" (primary) and "Plan with AI" (secondary).
- Each day uses the same rail component as Today.
- "Ask AI to suggest tasks" (existing proposal flow) lives in a collapsible section.

### Me

- Account (name, email, sign out), timezone (with "use this device's timezone"), weekly free hours
  (existing availability features, restyled).

### Auth and landing

- Centered single column on paper, plain copy, no "Welcome back".

## Behaviour changes outside the UI

- Marking a schedule item COMPLETED also marks its task COMPLETED; setting it back to SCHEDULED returns a
  COMPLETED task to TODO. Ownership is checked as before.
- Planning a date range no longer schedules a task that already has an upcoming SCHEDULED block outside that range
  (prevents duplicates when different ranges are planned).
- Default post-login destination becomes `/today`. `middleware.ts` is renamed to `proxy.ts` (Next 16 convention).
- Web app manifest and icons so the app can be added to the iPhone home screen and open full screen.

## Testing

- Unit tests (node:test) for the quick-add parser and the date helpers it uses.
- Existing scheduler and AI tests keep passing.
- `npm run lint`, `npm run build`, then manual check on iPhone width and laptop width.

## Out of scope

- Push notifications and reminders (piece C).
- Importing class schedules.
- Learning tracking.
