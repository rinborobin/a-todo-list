import type { StudyRating, StudySource } from "@/db/schema";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/scheduling/timezone";

export interface SessionLike {
  subjectId: string | null;
  topicId?: string | null;
  startedAt: Date;
  minutes: number;
  rating: StudyRating | null;
  source?: StudySource;
}

export interface SubjectStat {
  subjectId: string | null;
  minutes7d: number;
  sessions7d: number;
  lastStudiedAt: Date | null;
  latestRating: StudyRating | null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Per-subject totals for the last 7 days, plus the last studied time and the
 * most recent rating over all sessions passed in.
 */
export function summarizeStudy(
  sessions: SessionLike[],
  now: Date
): { totalMinutes7d: number; bySubject: Map<string | null, SubjectStat> } {
  const weekStart = now.getTime() - WEEK_MS;
  const bySubject = new Map<string | null, SubjectStat>();
  let totalMinutes7d = 0;
  let latestRatedAt = new Map<string | null, number>();

  for (const s of sessions) {
    const stat = bySubject.get(s.subjectId) ?? {
      subjectId: s.subjectId,
      minutes7d: 0,
      sessions7d: 0,
      lastStudiedAt: null,
      latestRating: null,
    };

    const started = s.startedAt.getTime();
    if (started >= weekStart && started <= now.getTime()) {
      stat.minutes7d += s.minutes;
      stat.sessions7d += 1;
      totalMinutes7d += s.minutes;
    }
    if (!stat.lastStudiedAt || started > stat.lastStudiedAt.getTime()) {
      stat.lastStudiedAt = s.startedAt;
    }
    if (s.rating && started > (latestRatedAt.get(s.subjectId) ?? -Infinity)) {
      stat.latestRating = s.rating;
      latestRatedAt = latestRatedAt.set(s.subjectId, started);
    }

    bySubject.set(s.subjectId, stat);
  }

  return { totalMinutes7d, bySubject };
}

/** Minutes studied per local day for the last `days` days, oldest first. */
export function dailyTotals(
  sessions: SessionLike[],
  now: Date,
  timezone: string,
  days = 7
): { date: string; minutes: number }[] {
  const today = toLocalDateKey(now, timezone);
  const totals = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) totals.set(addDaysToDateKey(today, -i), 0);

  for (const s of sessions) {
    const key = toLocalDateKey(s.startedAt, timezone);
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + s.minutes);
  }

  return [...totals].map(([date, minutes]) => ({ date, minutes }));
}
