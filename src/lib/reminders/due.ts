import { addDaysToDateKey, localDateTimeToUtc, toLocalDateKey, toLocalTimeString } from "@/lib/scheduling/timezone";

/**
 * Works out which reminders are due right now for one person. Pure: the
 * caller loads the data and decides what has already been sent, using each
 * reminder's dedupeKey.
 *
 * The scheduler runs roughly every 15 minutes and can be late, so every
 * reminder has a window after its time in which it is still worth sending, and
 * the wording always states the real due time rather than "in 2 hours".
 */

export type ReminderKind = "MORNING" | "DUE_DAY" | "DUE_SOON" | "OVERDUE";

export interface ReminderPrefs {
  morningEnabled: boolean;
  /** "HH:mm" or "HH:mm:ss", in the person's time zone. */
  morningTime: string;
  deadlineEnabled: boolean;
  overdueEnabled: boolean;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  morningEnabled: true,
  morningTime: "07:30",
  deadlineEnabled: true,
  overdueEnabled: true,
};

export interface ReminderTask {
  id: string;
  title: string;
  subjectName: string | null;
  status: string;
  deadline: Date;
  createdAt: Date;
}

export interface Reminder {
  kind: ReminderKind;
  dedupeKey: string;
  title: string;
  body: string;
  url: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** No reminders between these local times. */
export const QUIET_START = "22:00";
export const QUIET_END = "07:00";
/** A reminder that would land late in the evening or at night goes out at this time instead. */
const EVENING = "21:30";
/** Deadlines saved without a time are stored as the end of the day. */
const END_OF_DAY = "23:59";
/** When to remind about a date-only deadline: the day before and on the day. */
const DATE_ONLY_AT = "18:00";

/** How long after its time a reminder is still sent. */
const DEADLINE_WINDOW = 90 * MINUTE;
const OVERDUE_WINDOW = 12 * HOUR;
const MORNING_WINDOW = 3 * HOUR;
/** A task added less than this ago does not trigger a reminder straight away. */
const FRESH = HOUR;
/** The morning summary stops counting a task as overdue after this long. */
const STALE_OVERDUE = 7 * 24 * HOUR;

const MAX_TITLE = 60;
const MAX_LISTED = 3;

export function dueReminders(input: {
  now: Date;
  timezone: string;
  userId: string;
  prefs: ReminderPrefs;
  tasks: ReminderTask[];
  plannedBlocks: number;
}): Reminder[] {
  const { now, timezone, userId, prefs, plannedBlocks } = input;
  const nowMs = now.getTime();
  const today = toLocalDateKey(now, timezone);
  const quietNow = isQuiet(toLocalTimeString(now, timezone));
  const open = input.tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS");

  const reminders: Reminder[] = [];

  const inWindow = (fireAt: Date, window: number) => nowMs >= fireAt.getTime() && nowMs < fireAt.getTime() + window;

  for (const t of open) {
    const deadlineMs = t.deadline.getTime();
    const settled = nowMs - t.createdAt.getTime() >= FRESH;
    const dateOnly = toLocalTimeString(t.deadline, timezone) === END_OF_DAY;
    const dueDay = toLocalDateKey(t.deadline, timezone);
    const key = t.deadline.toISOString();

    if (prefs.deadlineEnabled && settled && !quietNow && nowMs < deadlineMs) {
      const dayBefore = dateOnly
        ? localDateTimeToUtc(addDaysToDateKey(dueDay, -1), DATE_ONLY_AT, timezone)
        : awayFromNight(new Date(deadlineMs - 24 * HOUR), timezone);
      const soon = dateOnly
        ? localDateTimeToUtc(dueDay, DATE_ONLY_AT, timezone)
        : awayFromNight(new Date(deadlineMs - 2 * HOUR), timezone);

      // The closer reminder wins when both would go out in the same check.
      const kind: ReminderKind | null = inWindow(soon, DEADLINE_WINDOW)
        ? "DUE_SOON"
        : inWindow(dayBefore, DEADLINE_WINDOW)
          ? "DUE_DAY"
          : null;
      if (kind) {
        reminders.push({
          kind,
          dedupeKey: `${kind.toLowerCase()}:${t.id}:${key}`,
          title: `Due ${dayWord(dueDay, today)}${dateOnly ? "" : ` at ${toLocalTimeString(t.deadline, timezone)}`}`,
          body: [shorten(t.title), t.subjectName].filter(Boolean).join(", "),
          url: `/tasks/${t.id}`,
        });
      }
    }

    if (prefs.overdueEnabled && settled && !quietNow && nowMs >= deadlineMs) {
      const clock = toLocalTimeString(t.deadline, timezone);
      const overnight = isNight(clock);
      // A deadline that passes at night is reported by the morning summary.
      // Without a summary, the nudge waits for the end of quiet hours.
      if (!(overnight && prefs.morningEnabled)) {
        const fireAt = overnight
          ? localDateTimeToUtc(clock >= EVENING ? addDaysToDateKey(dueDay, 1) : dueDay, QUIET_END, timezone)
          : t.deadline;
        if (inWindow(fireAt, OVERDUE_WINDOW)) {
          const when =
            dueDay === today
              ? `at ${clock}`
              : `${dayWord(dueDay, today)}${dateOnly ? "" : ` at ${clock}`}`;
          reminders.push({
            kind: "OVERDUE",
            dedupeKey: `overdue:${t.id}:${key}`,
            title: "Overdue",
            body: `${shorten(t.title)} was due ${when}`,
            url: `/tasks/${t.id}`,
          });
        }
      }
    }
  }

  if (prefs.morningEnabled) {
    const fireAt = localDateTimeToUtc(today, prefs.morningTime.slice(0, 5), timezone);
    if (inWindow(fireAt, MORNING_WINDOW)) {
      const dueToday = open
        .filter((t) => t.deadline.getTime() >= nowMs && toLocalDateKey(t.deadline, timezone) === today)
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
      const overdue = open.filter(
        (t) => t.deadline.getTime() < nowMs && nowMs - t.deadline.getTime() <= STALE_OVERDUE
      ).length;

      const parts: string[] = [];
      if (dueToday.length > 0) {
        const listed = dueToday.slice(0, MAX_LISTED).map((t) => {
          const clock = toLocalTimeString(t.deadline, timezone);
          return clock === END_OF_DAY ? shorten(t.title) : `${shorten(t.title)} ${clock}`;
        });
        const more = dueToday.length - listed.length;
        parts.push(`${dueToday.length} due today: ${listed.join(", ")}${more > 0 ? ` and ${more} more` : ""}`);
      }
      if (overdue > 0) parts.push(`${overdue} overdue`);
      if (plannedBlocks > 0) parts.push(`${plannedBlocks} ${plannedBlocks === 1 ? "block" : "blocks"} planned`);

      if (parts.length > 0) {
        reminders.push({
          kind: "MORNING",
          dedupeKey: `morning:${userId}:${today}`,
          title: "Today",
          body: `${parts.join(". ")}.`,
          url: "/today",
        });
      }
    }
  }

  return reminders;
}

function isQuiet(clock: string): boolean {
  return clock >= QUIET_START || clock < QUIET_END;
}

/** Quiet hours plus the last half hour before them, when the next check could already be too late. */
function isNight(clock: string): boolean {
  return clock >= EVENING || clock < QUIET_END;
}

/** Moves a time that falls at night to 21:30 on the evening before it. */
function awayFromNight(at: Date, timezone: string): Date {
  const clock = toLocalTimeString(at, timezone);
  const day = toLocalDateKey(at, timezone);
  if (clock >= EVENING) return localDateTimeToUtc(day, EVENING, timezone);
  if (clock < QUIET_END) return localDateTimeToUtc(addDaysToDateKey(day, -1), EVENING, timezone);
  return at;
}

function dayWord(day: string, today: string): string {
  if (day === today) return "today";
  if (day === addDaysToDateKey(today, 1)) return "tomorrow";
  if (day === addDaysToDateKey(today, -1)) return "yesterday";
  return `on ${new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(`${day}T12:00:00Z`)
  )}`;
}

function shorten(title: string): string {
  const clean = title.trim();
  return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trimEnd()}…` : clean;
}
