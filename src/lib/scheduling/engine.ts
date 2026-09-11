import type { Availability, Task } from "@/db/schema";
import {
  getDatesInRange,
  getDayOfWeek,
  localDateTimeToUtc,
} from "./timezone";
import type {
  ScheduleInput,
  ScheduleOutput,
  ScheduledItem,
  TimeWindow,
  UnscheduledReason,
  UnscheduledTask,
} from "./types";
import {
  UNSCHEDULED_REASON_MESSAGES,
} from "./types";

const SCHEDULABLE_STATUSES = new Set(["TODO", "IN_PROGRESS"]);

interface SortableTask {
  task: Task;
  priorityScore: number;
}

export function scheduleTasks(input: ScheduleInput): ScheduleOutput {
  const {
    tasks,
    availability,
    existingItems,
    timezone,
    startDate,
    endDate,
    now,
  } = input;

  const sortedTasks = sortTasks(tasks);
  const freeWindowsByDay = buildFreeWindowsByDay({
    availability,
    existingItems,
    timezone,
    startDate,
    endDate,
    now,
  });

  // Flatten all free windows into one chronological list, mutating as we go.
  const allWindows: TimeWindow[] = [];
  for (const windows of freeWindowsByDay.values()) {
    allWindows.push(...windows);
  }
  allWindows.sort((a, b) => a.start.getTime() - b.start.getTime());

  const scheduled: ScheduledItem[] = [];
  const unscheduled: UnscheduledTask[] = [];

  for (const { task } of sortedTasks) {
    const result = scheduleTask(task, allWindows, now);
    if (result.success) {
      scheduled.push(result.item);
    } else {
      unscheduled.push({
        task,
        reason: UNSCHEDULED_REASON_MESSAGES[result.reason],
      });
    }
  }

  return { scheduled, unscheduled };
}

function sortTasks(tasks: Task[]): SortableTask[] {
  const priorityScores: Record<Task["priority"], number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const withScore = tasks.map((task) => ({
    task,
    priorityScore: priorityScores[task.priority],
  }));

  withScore.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    const aDeadline = a.task.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDeadline = b.task.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aDeadline !== bDeadline) {
      return aDeadline - bDeadline;
    }

    const aDuration = a.task.estimatedMinutes ?? Number.POSITIVE_INFINITY;
    const bDuration = b.task.estimatedMinutes ?? Number.POSITIVE_INFINITY;
    if (aDuration !== bDuration) {
      return aDuration - bDuration;
    }

    return a.task.createdAt.getTime() - b.task.createdAt.getTime();
  });

  return withScore;
}

interface FreeWindowBuildInput {
  availability: Availability[];
  existingItems: TimeWindow[];
  timezone: string;
  startDate: string;
  endDate: string;
  now: Date;
}

function buildFreeWindowsByDay(
  input: FreeWindowBuildInput
): Map<string, TimeWindow[]> {
  const { availability, existingItems, timezone, startDate, endDate, now } = input;
  const dates = getDatesInRange(startDate, endDate);
  const result = new Map<string, TimeWindow[]>();

  const nowDateKey = toDateKey(now);

  for (const dateString of dates) {
    const dayOfWeek = getDayOfWeek(dateString, timezone);
    const blocks = availability.filter((a) => a.dayOfWeek === dayOfWeek);

    let windows: TimeWindow[] = blocks.map((block) => ({
      start: localDateTimeToUtc(dateString, block.startTime, timezone),
      end: localDateTimeToUtc(dateString, block.endTime, timezone),
    }));

    // Subtract existing schedule items.
    for (const item of existingItems) {
      windows = subtractWindow(windows, item);
    }

    // Clip windows on the current day to not start before `now`.
    if (dateString === nowDateKey) {
      windows = windows
        .map((w) => ({
          start: w.start < now ? now : w.start,
          end: w.end,
        }))
        .filter((w) => w.start < w.end);
    }

    windows.sort((a, b) => a.start.getTime() - b.start.getTime());
    result.set(dateString, windows);
  }

  return result;
}

function subtractWindow(windows: TimeWindow[], item: TimeWindow): TimeWindow[] {
  const result: TimeWindow[] = [];

  for (const window of windows) {
    if (item.end <= window.start || item.start >= window.end) {
      result.push(window);
      continue;
    }

    if (item.start > window.start) {
      result.push({ start: window.start, end: item.start });
    }

    if (item.end < window.end) {
      result.push({ start: item.end, end: window.end });
    }
  }

  return result;
}

interface ScheduleSuccess {
  success: true;
  item: ScheduledItem;
}

interface ScheduleFailure {
  success: false;
  reason: UnscheduledReason;
}

type ScheduleResult = ScheduleSuccess | ScheduleFailure;

function scheduleTask(
  task: Task,
  windows: TimeWindow[],
  now: Date
): ScheduleResult {
  if (!SCHEDULABLE_STATUSES.has(task.status)) {
    return { success: false, reason: "completed_or_cancelled" };
  }

  const duration = task.estimatedMinutes;
  if (!duration || duration <= 0) {
    return { success: false, reason: "no_estimated_duration" };
  }

  if (task.deadline && task.deadline < now) {
    return { success: false, reason: "deadline_passed" };
  }

  let largestWindowMinutes = 0;

  for (const window of windows) {
    const windowMinutes = (window.end.getTime() - window.start.getTime()) / 60_000;
    largestWindowMinutes = Math.max(largestWindowMinutes, windowMinutes);

    if (windowMinutes < duration) {
      continue;
    }

    const endTime = new Date(window.start.getTime() + duration * 60_000);

    if (task.deadline && endTime > task.deadline) {
      continue;
    }

    // Place task at the start of the first fitting window.
    const item: ScheduledItem = {
      taskId: task.id,
      startTime: window.start,
      endTime,
    };

    // Reduce the used window.
    window.start = endTime;

    return { success: true, item };
  }

  if (largestWindowMinutes < duration) {
    return { success: false, reason: "too_long_for_any_window" };
  }

  return { success: false, reason: "no_available_time" };
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export { toDateKey };
