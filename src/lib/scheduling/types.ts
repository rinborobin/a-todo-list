import type { Availability, DayOfWeek, Task } from "@/db/schema";

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface ScheduledItem {
  taskId: string;
  startTime: Date;
  endTime: Date;
}

export interface UnscheduledTask {
  task: Task;
  reason: string;
}

export interface ScheduleInput {
  tasks: Task[];
  availability: Availability[];
  existingItems: TimeWindow[];
  timezone: string;
  startDate: string;
  endDate: string;
  now: Date;
  taskOrder?: string[];
}

export interface ScheduleOutput {
  scheduled: ScheduledItem[];
  unscheduled: UnscheduledTask[];
}

export interface AvailabilityBlock {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export type UnscheduledReason =
  | "no_estimated_duration"
  | "deadline_passed"
  | "too_long_for_any_window"
  | "no_available_time"
  | "completed_or_cancelled";

export const UNSCHEDULED_REASON_MESSAGES: Record<UnscheduledReason, string> = {
  no_estimated_duration: "Task has no estimated duration",
  deadline_passed: "Task deadline has passed or is before the earliest available slot",
  too_long_for_any_window: "Task is longer than any available contiguous time window",
  no_available_time: "No available time window fits the task in the requested range",
  completed_or_cancelled: "Task is completed or cancelled",
};
