import type { TaskPriority } from "@/db/schema";
import {
  DAY_OF_WEEK_VALUES,
  addDaysToDateKey,
  getDayOfWeek,
  localDateTimeToUtc,
  toLocalDateKey,
} from "@/lib/scheduling/timezone";

export interface QuickAddResult {
  title: string;
  deadline: Date | null;
  estimatedMinutes: number;
  /** True when no duration was typed and the default was used. */
  estimateIsDefault: boolean;
  priority: TaskPriority;
  /** Subject matched from a "#tag", or null. */
  subjectId: string | null;
  /** The tag as typed (without "#"), even when it matched nothing. */
  subjectTag: string | null;
}

export interface QuickAddOptions {
  now: Date;
  timezone: string;
  subjects?: { id: string; name: string }[];
}

/**
 * Resolves "#calc" to a subject: an exact name wins, otherwise a unique
 * prefix of the name (spaces ignored). Ambiguous or unknown tags match nothing.
 */
function matchSubject(tag: string, subjects: { id: string; name: string }[]): string | null {
  const needle = tag.toLowerCase();
  const exact = subjects.find((s) => s.name.toLowerCase() === needle);
  if (exact) return exact.id;
  const prefixed = subjects.filter((s) => {
    const name = s.name.toLowerCase();
    return name.startsWith(needle) || name.replace(/\s+/g, "").startsWith(needle);
  });
  return prefixed.length === 1 ? prefixed[0].id : null;
}

export const DEFAULT_ESTIMATE_MINUTES = 60;
const MAX_ESTIMATE_MINUTES = 1440;
const END_OF_DAY = "23:59";

// Connector words are only removed when they introduce a date or time ("due fri", "at 5pm").
const CONNECTOR = String.raw`(?:\b(?:due|by|at|on|before)\s+)?`;

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
const WEEKDAY_PATTERN = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join("|");

const MONTH_PATTERN =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

function monthIndex(name: string): number {
  const prefixes = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return prefixes.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

/**
 * Parses a one-line task description such as "db essay due fri 5pm 2h".
 *
 * Dates and times are interpreted in the user's timezone. Anything that is not
 * recognised as a date, time, duration or priority becomes the title.
 */
export function parseQuickAdd(input: string, options: QuickAddOptions): QuickAddResult {
  const { now, timezone } = options;
  let rest = ` ${input} `;

  const take = (pattern: RegExp): RegExpExecArray | null => {
    const match = pattern.exec(rest);
    if (match) {
      rest = rest.slice(0, match.index) + " " + rest.slice(match.index + match[0].length);
    }
    return match;
  };

  // Subject tag. Only removed from the title when it matches a subject.
  let subjectId: string | null = null;
  let subjectTag: string | null = null;
  const tagPattern = /(?<=\s)#([\p{L}\p{N}_-]+)(?=\s)/u;
  const tag = tagPattern.exec(rest);
  if (tag) {
    subjectTag = tag[1];
    subjectId = matchSubject(subjectTag, options.subjects ?? []);
    if (subjectId) take(tagPattern);
  }

  // Priority
  let priority: TaskPriority = "MEDIUM";
  const bangs = take(/(?<=\s)(!{1,3})(?=\s)/);
  if (bangs) {
    priority = bangs[1].length >= 2 ? "URGENT" : "HIGH";
  }
  if (take(/\burgent\b/i)) {
    priority = "URGENT";
  }

  // Time of day (before durations so "5:30pm" is never read as 30 minutes)
  let time: string | null = null;
  const ampm = take(new RegExp(String.raw`${CONNECTOR}\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b`, "i"));
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = ampm[2] ?? "00";
    if (hours >= 1 && hours <= 12) {
      const isPm = ampm[3].toLowerCase() === "pm";
      if (hours === 12) hours = isPm ? 12 : 0;
      else if (isPm) hours += 12;
      time = `${String(hours).padStart(2, "0")}:${minutes}`;
    }
  } else {
    const clock = take(new RegExp(String.raw`${CONNECTOR}\b([01]?\d|2[0-3]):([0-5]\d)\b`, "i"));
    if (clock) {
      time = `${clock[1].padStart(2, "0")}:${clock[2]}`;
    } else if (take(new RegExp(String.raw`${CONNECTOR}\bnoon\b`, "i"))) {
      time = "12:00";
    }
  }

  // Duration
  let estimatedMinutes: number | null = null;
  const hoursAndMinutes =
    take(/\b(\d+)\s*h(?:ours?|rs?)?\s*(\d{1,2})\s*m(?:in(?:ute)?s?)?\b/i) ?? take(/\b(\d+)h(\d{1,2})\b/i);
  if (hoursAndMinutes) {
    estimatedMinutes = Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2]);
  } else {
    const hoursOnly = take(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
    if (hoursOnly) {
      estimatedMinutes = Math.round(Number(hoursOnly[1]) * 60);
    } else {
      const minutesOnly = take(/\b(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
      if (minutesOnly) {
        estimatedMinutes = Number(minutesOnly[1]);
      }
    }
  }
  if (estimatedMinutes !== null) {
    estimatedMinutes = Math.min(Math.max(estimatedMinutes, 1), MAX_ESTIMATE_MINUTES);
  }

  // Date
  const todayKey = toLocalDateKey(now, timezone);
  let dateKey: string | null = null;

  const relative = take(new RegExp(String.raw`${CONNECTOR}\bin\s+(\d{1,3})\s+days?\b`, "i"));
  if (relative) {
    dateKey = addDaysToDateKey(todayKey, Number(relative[1]));
  }

  if (!dateKey) {
    const named = take(new RegExp(String.raw`${CONNECTOR}\b(today|tonight|tomorrow|tmrw|tmr)\b`, "i"));
    if (named) {
      const word = named[1].toLowerCase();
      dateKey = word === "today" || word === "tonight" ? todayKey : addDaysToDateKey(todayKey, 1);
    }
  }

  if (!dateKey) {
    const dayMonth =
      take(new RegExp(String.raw`${CONNECTOR}\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_PATTERN})\b`, "i")) ??
      null;
    const monthDay = dayMonth
      ? null
      : take(new RegExp(String.raw`${CONNECTOR}\b(${MONTH_PATTERN})\s+(\d{1,2})(?:st|nd|rd|th)?\b`, "i"));
    if (dayMonth || monthDay) {
      const day = Number(dayMonth ? dayMonth[1] : monthDay![2]);
      const month = monthIndex(dayMonth ? dayMonth[2] : monthDay![1]);
      dateKey = resolveMonthDay(todayKey, month, day);
    }
  }

  if (!dateKey) {
    const weekday = take(new RegExp(String.raw`${CONNECTOR}\b(next\s+)?(${WEEKDAY_PATTERN})\b`, "i"));
    if (weekday) {
      const target = WEEKDAYS[weekday[2].toLowerCase()];
      const current = DAY_OF_WEEK_VALUES.indexOf(getDayOfWeek(todayKey, timezone));
      let diff = (target - current + 7) % 7;
      if (weekday[1] && diff === 0) diff = 7;
      dateKey = addDaysToDateKey(todayKey, diff);
    }
  }

  let deadline: Date | null = null;
  if (dateKey) {
    deadline = localDateTimeToUtc(dateKey, time ?? END_OF_DAY, timezone);
  } else if (time) {
    deadline = localDateTimeToUtc(todayKey, time, timezone);
    if (deadline.getTime() <= now.getTime()) {
      deadline = localDateTimeToUtc(addDaysToDateKey(todayKey, 1), time, timezone);
    }
  }

  return {
    title: cleanTitle(rest),
    deadline,
    estimatedMinutes: estimatedMinutes ?? DEFAULT_ESTIMATE_MINUTES,
    estimateIsDefault: estimatedMinutes === null,
    priority,
    subjectId,
    subjectTag,
  };
}

function resolveMonthDay(todayKey: string, month: number, day: number): string | null {
  const year = Number(todayKey.slice(0, 4));
  const candidate = (y: number) => {
    const date = new Date(Date.UTC(y, month - 1, day));
    if (date.getUTCMonth() !== month - 1) return null; // e.g. 31 nov
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const thisYear = candidate(year);
  if (!thisYear) return null;
  return thisYear < todayKey ? candidate(year + 1) : thisYear;
}

function cleanTitle(text: string): string {
  const collapsed = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,;:\-]+|[\s,;:\-]+$/g, "");
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}
