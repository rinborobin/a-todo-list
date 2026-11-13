import { addDaysToDateKey, toLocalDateKey } from "@/lib/scheduling/timezone";

export interface PracticeStreak {
  /** Days per week the user wants to practise. */
  target: number;
  /** Distinct local days with practice since Monday, today included. */
  daysThisWeek: number;
  practicedToday: boolean;
  /** Days left in the week, today included. */
  daysLeft: number;
  /** More practice days needed this week to hit the target. */
  needed: number;
  /** The target is met, or can be met with a day to spare. */
  onTrack: boolean;
  /** Practising today is the only way to keep the streak (daily) or hit this week's target. */
  atRisk: boolean;
  /** Consecutive practice days ending today, or yesterday while today is still open. */
  streakDays: number;
  /** Consecutive weeks that met the target, counting this week once it is met. */
  streakWeeks: number;
}

const MAX_WEEKS_BACK = 52;

/** Monday = 0 ... Sunday = 6, for a YYYY-MM-DD key. */
function weekdayIndex(dateKey: string): number {
  return (new Date(`${dateKey}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * How regular practice is going for one thing, from its sessions. Days are the
 * user's local days and weeks start on Monday.
 */
export function practiceStreak(
  sessions: { startedAt: Date }[],
  { now, timezone, daysPerWeek }: { now: Date; timezone: string; daysPerWeek: number }
): PracticeStreak {
  const target = Math.min(7, Math.max(1, Math.round(daysPerWeek)));
  const today = toLocalDateKey(now, timezone);
  const days = new Set(sessions.map((s) => toLocalDateKey(s.startedAt, timezone)));
  const weekStart = addDaysToDateKey(today, -weekdayIndex(today));

  const countWeek = (start: string) => {
    let count = 0;
    for (let i = 0; i < 7; i++) if (days.has(addDaysToDateKey(start, i))) count += 1;
    return count;
  };

  const practicedToday = days.has(today);
  let daysThisWeek = 0;
  for (let key = weekStart; key <= today; key = addDaysToDateKey(key, 1)) if (days.has(key)) daysThisWeek += 1;

  const daysLeft = 7 - weekdayIndex(today);
  const needed = Math.max(0, target - daysThisWeek);
  // Days still open this week: today counts only if it has not been practised yet.
  const openDays = daysLeft - (practicedToday ? 1 : 0);
  const onTrack = needed === 0 || needed < openDays;

  let streakDays = 0;
  for (let key = practicedToday ? today : addDaysToDateKey(today, -1); days.has(key); key = addDaysToDateKey(key, -1)) {
    streakDays += 1;
  }

  let streakWeeks = needed === 0 ? 1 : 0;
  for (let w = 1; w <= MAX_WEEKS_BACK; w++) {
    if (countWeek(addDaysToDateKey(weekStart, -7 * w)) < target) break;
    streakWeeks += 1;
  }

  const atRisk =
    !practicedToday && (target === 7 ? streakDays > 0 : needed > 0 && needed === daysLeft);

  return { target, daysThisWeek, practicedToday, daysLeft, needed, onTrack, atRisk, streakDays, streakWeeks };
}

/** "5-day streak", "3 of 5 days this week", ... for one line of UI. */
export function describeStreak(streak: PracticeStreak): string {
  if (streak.target === 7) {
    if (streak.atRisk) return `keep your ${streak.streakDays}-day streak`;
    if (streak.streakDays >= 2) return `${streak.streakDays}-day streak`;
    return streak.practicedToday ? "practised today" : "practise today to start a streak";
  }
  return `${streak.daysThisWeek} of ${streak.target} days this week`;
}
