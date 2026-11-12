import type { StudySource } from "@/db/schema";
import { toLocalTimeString } from "@/lib/scheduling/timezone";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * How long this person actually focuses: the median timer session, rounded to
 * 5 minutes. Planned blocks and manual logs are excluded because their length
 * is set by the plan or typed, not measured. Needs at least three sessions.
 */
export function typicalMinutes(sessions: { minutes: number; source: StudySource }[]): number | null {
  const timed = sessions.filter((s) => s.source === "TIMER" && s.minutes > 0).map((s) => s.minutes);
  if (timed.length < 3) return null;
  return Math.max(5, Math.round(median(timed) / 5) * 5);
}

/**
 * The hours of the day (0-23, local time) this person usually starts studying,
 * busiest first. Only hours with at least two sessions count. Manual logs are
 * skipped because their time is not when the study happened.
 */
export function usualHours(sessions: { startedAt: Date; source: StudySource }[], timezone: string): number[] {
  const counts = new Map<number, number>();
  for (const s of sessions) {
    if (s.source === "MANUAL") continue;
    const hour = Number(toLocalTimeString(s.startedAt, timezone).slice(0, 2));
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 3)
    .map(([hour]) => hour);
}

/**
 * How time estimates compare to reality: the median of actual / estimated
 * minutes across finished tasks. 1.3 means tasks take about 30% longer than
 * estimated. Needs at least three tasks.
 */
export function estimateRatio(tasks: { estimatedMinutes: number; actualMinutes: number }[]): number | null {
  const ratios = tasks
    .filter((t) => t.estimatedMinutes > 0 && t.actualMinutes > 0)
    .map((t) => t.actualMinutes / t.estimatedMinutes);
  if (ratios.length < 3) return null;
  return Math.round(median(ratios) * 100) / 100;
}
