import type { ScheduleItemStatus } from "@/db/schema";
import { toLocalDateKey } from "./timezone";
import type { ScheduledItem, TimeWindow } from "./types";

export interface ExistingScheduleItem {
  status: ScheduleItemStatus;
  taskId?: string | null;
  startTime: Date;
  endTime: Date;
}

/**
 * Groups scheduled items by the calendar date they start on in the user's
 * timezone, which is the date their DailyPlan is stored under.
 */
export function groupScheduledItemsByLocalDate(
  items: ScheduledItem[],
  timezone: string
): Map<string, ScheduledItem[]> {
  const groups = new Map<string, ScheduledItem[]>();
  for (const item of items) {
    const dateKey = toLocalDateKey(item.startTime, timezone);
    const group = groups.get(dateKey) ?? [];
    group.push(item);
    groups.set(dateKey, group);
  }
  return groups;
}

/**
 * Returns the time windows that a regenerated plan must avoid.
 *
 * Regeneration replaces items that are still SCHEDULED, so they must not block
 * their own slots. Items the user already marked COMPLETED or SKIPPED are kept
 * and continue to occupy their time.
 *
 * When only some tasks are being replanned (`replanTaskIds`), scheduled items
 * of every other task stay where they are and also count as busy.
 */
export function buildBusyWindows(items: ExistingScheduleItem[], replanTaskIds?: Set<string>): TimeWindow[] {
  return items
    .filter(
      (item) =>
        item.status !== "SCHEDULED" || (replanTaskIds !== undefined && !replanTaskIds.has(item.taskId ?? ""))
    )
    .map((item) => ({ start: item.startTime, end: item.endTime }));
}
