export const GOAL_CHOICES = [25, 45, 60, 90, 120] as const;
export const MIN_GOAL_MINUTES = 5;
export const MAX_GOAL_MINUTES = 480;
const DEFAULT_GOAL_MINUTES = 60;

export interface FocusTime {
  elapsedSec: number;
  leftSec: number;
  overSec: number;
  /** 1 at the start, 0 once the goal is reached. Drives the sundial shade. */
  fractionLeft: number;
  goalReached: boolean;
}

/**
 * Time on the focus screen, always derived from the start time so a locked
 * phone, a background tab or a reload never makes the clock drift.
 */
export function computeFocusTime(startedAt: Date, now: Date, plannedMinutes: number): FocusTime {
  const goalSec = Math.max(1, plannedMinutes * 60);
  const elapsedSec = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  const leftSec = Math.max(0, goalSec - elapsedSec);
  const overSec = Math.max(0, elapsedSec - goalSec);
  return {
    elapsedSec,
    leftSec,
    overSec,
    fractionLeft: leftSec / goalSec,
    goalReached: elapsedSec >= goalSec,
  };
}

/** "12:34" under an hour, "1:05:09" from an hour up. */
export function formatTimer(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** The task's estimate, or an hour, kept within the allowed range. */
export function defaultGoalMinutes(estimate: number | null | undefined): number {
  const value = estimate ?? DEFAULT_GOAL_MINUTES;
  return Math.min(MAX_GOAL_MINUTES, Math.max(MIN_GOAL_MINUTES, Math.round(value)));
}
