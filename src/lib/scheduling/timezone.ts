import type { DayOfWeek } from "@/db/schema";
import type { TimeWindow } from "./types";

export const DAY_OF_WEEK_VALUES: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/**
 * Returns the DayOfWeek enum value for a given local date (YYYY-MM-DD) in the
 * supplied IANA timezone.
 */
export function getDayOfWeek(dateString: string, timezone: string): DayOfWeek {
  const localMidnight = localDateTimeToUtc(dateString, "00:00:00", timezone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  });

  const parts = formatter.formatToParts(localMidnight);
  const weekday = parts.find((part) => part.type === "weekday")?.value;

  if (!weekday) {
    throw new Error("Unable to determine weekday for date");
  }

  return weekdayToEnum(weekday);
}

function weekdayToEnum(weekday: string): DayOfWeek {
  const map: Record<string, DayOfWeek> = {
    Sunday: "SUNDAY",
    Monday: "MONDAY",
    Tuesday: "TUESDAY",
    Wednesday: "WEDNESDAY",
    Thursday: "THURSDAY",
    Friday: "FRIDAY",
    Saturday: "SATURDAY",
  };

  const value = map[weekday];
  if (!value) {
    throw new Error(`Unknown weekday: ${weekday}`);
  }
  return value;
}

/**
 * Builds a UTC Date representing the exact wall-clock instant of `time` on the
 * local `dateString` (YYYY-MM-DD) within the supplied IANA timezone. Iteratively
 * corrects for DST transitions and offsets.
 */
export function localDateTimeToUtc(
  dateString: string,
  time: string,
  timezone: string
): Date {
  const [year, month, day] = parseDate(dateString);
  const [hours, minutes] = parseTime(time);

  // Naive UTC interpretation of the desired local date/time.
  let utc = new Date(Date.UTC(year, month - 1, day, hours, minutes));

  // Correct for timezone offset. Usually converges in one iteration; cap at 3
  // to avoid an infinite loop on pathological inputs.
  for (let i = 0; i < 3; i++) {
    const offsetMinutes = getTimezoneOffsetMinutes(utc, timezone);
    const corrected = new Date(utc.getTime() + offsetMinutes * 60_000);
    const parts = formatParts(corrected, timezone);

    if (
      Number(parts.year) === year &&
      Number(parts.month) === month &&
      Number(parts.day) === day &&
      parts.hour === hours &&
      parts.minute === minutes
    ) {
      return corrected;
    }

    utc = corrected;
  }

  return utc;
}


/**
 * Returns the timezone offset in minutes west of UTC for the given UTC instant.
 */
export function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const utcFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const tzFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const utcParts = parseDateParts(utcFormatter.formatToParts(date));
  const tzParts = parseDateParts(tzFormatter.formatToParts(date));

  const utcTime = Date.UTC(
    utcParts.year,
    utcParts.month - 1,
    utcParts.day,
    utcParts.hour,
    utcParts.minute,
    utcParts.second
  );
  const tzTime = Date.UTC(
    tzParts.year,
    tzParts.month - 1,
    tzParts.day,
    tzParts.hour,
    tzParts.minute,
    tzParts.second
  );

  return (utcTime - tzTime) / 60_000;
}

function parseDateParts(parts: Intl.DateTimeFormatPart[]) {
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number.parseInt(get("year") || "0", 10),
    month: Number.parseInt(get("month") || "0", 10),
    day: Number.parseInt(get("day") || "0", 10),
    hour: Number.parseInt(get("hour") || "0", 10),
    minute: Number.parseInt(get("minute") || "0", 10),
    second: Number.parseInt(get("second") || "0", 10),
  };
}

function parseDate(dateString: string): [number, number, number] {
  const parts = dateString.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  const year = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  return [year, month, day];
}

function parseTime(time: string): [number, number] {
  const parts = time.split(":");
  if (parts.length < 2) {
    throw new Error(`Invalid time format: ${time}`);
  }
  const hours = Number.parseInt(parts[0], 10);
  const minutes = Number.parseInt(parts[1], 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Invalid time format: ${time}`);
  }

  return [hours, minutes];
}

function formatParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number.parseInt(get("hour") || "0", 10),
    minute: Number.parseInt(get("minute") || "0", 10),
  };
}

/**
 * Returns all local dates between start and end (inclusive) as YYYY-MM-DD
 * strings. The inputs are local dates in the target timezone.
 */
export function getDatesInRange(startDate: string, endDate: string): string[] {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const dates: string[] = [];

  const current = new Date(start);
  while (current.getTime() <= end.getTime()) {
    dates.push(toDateString(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = parseDate(dateString);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether two time windows overlap.
 */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start < b.end && b.start < a.end;
}
