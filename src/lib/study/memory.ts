import type { StudyRating } from "@/db/schema";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/scheduling/timezone";

export interface MemorySession {
  startedAt: Date;
  rating: StudyRating | null;
}

export interface MemoryState {
  /** Days until the next review, as of the last study day. */
  intervalDays: number;
  /** YYYY-MM-DD in the user's timezone. */
  nextReviewOn: string;
  lastStudiedOn: string;
  lastRating: StudyRating | null;
  /** Number of study days (several sessions on one day count once). */
  reviews: number;
}

const MAX_INTERVAL_DAYS = 60;

// Lower = worse. Used to pick one rating per study day.
const RATING_RANK: Record<StudyRating, number> = { STRUGGLED: 0, OK: 1, GOT_IT: 2 };

function firstInterval(rating: StudyRating | null): number {
  if (rating === "STRUGGLED") return 1;
  if (rating === "GOT_IT") return 4;
  return 2; // OK or unrated
}

function nextInterval(previous: number, rating: StudyRating | null): number {
  if (rating === "STRUGGLED") return 1;
  if (rating === "GOT_IT") return Math.max(3, Math.round(previous * 2.5));
  if (rating === "OK") return Math.max(2, Math.round(previous * 1.6));
  return Math.max(2, Math.round(previous * 1.3)); // studied, but not rated
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Spaced-repetition state for a subject or topic, rebuilt from its sessions.
 *
 * Each study day moves the review interval: a struggle resets it to a day, an
 * OK grows it a little, "Got it" grows it a lot. Several sessions on one day
 * count as one review using that day's lowest rating. An upcoming exam pulls
 * the next review to before the exam. Replaying (instead of storing state)
 * means ratings added later, edits and deletions are always reflected.
 */
export function replayMemory(
  sessions: MemorySession[],
  { timezone, examDate = null }: { timezone: string; examDate?: string | null }
): MemoryState | null {
  if (sessions.length === 0) return null;

  // One entry per local study day, with the lowest rating given that day.
  const days = new Map<string, StudyRating | null>();
  for (const s of [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) {
    const day = toLocalDateKey(s.startedAt, timezone);
    const current = days.has(day) ? days.get(day)! : null;
    if (!days.has(day) || (s.rating && (current === null || RATING_RANK[s.rating] < RATING_RANK[current]))) {
      days.set(day, s.rating ?? current);
    }
  }

  let interval = 0;
  let lastDay = "";
  let lastRating: StudyRating | null = null;
  let reviews = 0;
  for (const [day, rating] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    interval = reviews === 0 ? firstInterval(rating) : nextInterval(interval, rating);
    interval = Math.min(interval, MAX_INTERVAL_DAYS);
    lastDay = day;
    lastRating = rating;
    reviews += 1;
  }

  let nextReviewOn = addDaysToDateKey(lastDay, interval);
  if (examDate && examDate > lastDay) {
    const dayBeforeExam = addDaysToDateKey(examDate, -1);
    if (nextReviewOn > dayBeforeExam) {
      const earliest = addDaysToDateKey(lastDay, 1);
      nextReviewOn = dayBeforeExam > earliest ? dayBeforeExam : earliest;
    }
  }

  return { intervalDays: interval, nextReviewOn, lastStudiedOn: lastDay, lastRating, reviews };
}

/** Whether a review is due on `today` (YYYY-MM-DD), and by how much. */
export function reviewStatus(
  state: MemoryState,
  today: string
): { due: boolean; overdueDays: number; dueInDays: number } {
  const dueInDays = daysBetween(today, state.nextReviewOn);
  return { due: dueInDays <= 0, overdueDays: Math.max(0, -dueInDays), dueInDays };
}
