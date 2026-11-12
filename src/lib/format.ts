import { addDaysToDateKey, toLocalDateKey } from "@/lib/scheduling/timezone";

/** "14:05" in the user's timezone. */
export function formatClock(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "45m", "1h", "1h 30m". */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "in 40 min", "in 2h 10m", "now". For short horizons only. */
export function formatStartsIn(start: Date, now: Date): string {
  const minutes = Math.round((start.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  return `in ${formatDuration(minutes)}`;
}

/** Parts of a date key formatted for headings, e.g. { weekday: "Wednesday", day: "11 November" }. */
export function formatDayHeading(dateKey: string): { weekday: string; day: string; short: string } {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(date);
  return {
    weekday: fmt({ weekday: "long" }),
    day: fmt({ day: "numeric", month: "long" }),
    short: fmt({ weekday: "short", day: "numeric", month: "short" }),
  };
}

export type DueTone = "overdue" | "soon" | "normal";

/**
 * Human label for a deadline relative to now, in the user's timezone:
 * "Overdue", "Today 17:00", "Tomorrow 23:59", "Fri 17:00", "24 Nov".
 * "soon" means within the next 24 hours.
 */
export function describeDue(deadline: Date, now: Date, timezone: string): { label: string; tone: DueTone } {
  const ms = deadline.getTime() - now.getTime();
  const today = toLocalDateKey(now, timezone);
  const dueDay = toLocalDateKey(deadline, timezone);
  const clock = formatClock(deadline, timezone);
  const time = clock === "23:59" ? "" : ` ${clock}`;

  if (ms < 0) {
    const daysLate = Math.floor(-ms / 86_400_000);
    return { label: daysLate >= 1 ? `Overdue ${daysLate}d` : "Overdue", tone: "overdue" };
  }

  const tone: DueTone = ms <= 86_400_000 ? "soon" : "normal";

  if (dueDay === today) return { label: `Today${time}`, tone };
  if (dueDay === addDaysToDateKey(today, 1)) return { label: `Tomorrow${time}`, tone };
  if (dueDay <= addDaysToDateKey(today, 6)) {
    const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short" }).format(deadline);
    return { label: `${weekday}${time}`, tone };
  }
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "short" }).format(
    deadline
  );
  return { label: `${date}${time}`, tone };
}
