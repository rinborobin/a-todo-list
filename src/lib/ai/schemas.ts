import { z } from "zod";
import type { DayOfWeek, Task } from "@/db/schema";

export const aiPlanTaskInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["TODO", "IN_PROGRESS"]),
  estimatedMinutes: z.number().int().positive(),
  deadline: z.string().nullable(), // ISO 8601 timestamp or null
});

export type AiPlanTaskInput = z.infer<typeof aiPlanTaskInputSchema>;

export const aiPlanAvailabilityInputSchema = z.object({
  dayOfWeek: z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]),
  startTime: z.string(), // HH:mm:ss
  endTime: z.string(),
});

export type AiPlanAvailabilityInput = z.infer<typeof aiPlanAvailabilityInputSchema>;

export const aiPlanScheduleItemInputSchema = z.object({
  taskId: z.string().nullable(),
  startTime: z.string(), // ISO 8601
  endTime: z.string(),
});

export type AiPlanScheduleItemInput = z.infer<typeof aiPlanScheduleItemInputSchema>;

export const aiPlanInputSchema = z.object({
  currentDate: z.string(), // YYYY-MM-DD
  currentTime: z.string(), // HH:mm
  timezone: z.string(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  tasks: z.array(aiPlanTaskInputSchema),
  availability: z.array(aiPlanAvailabilityInputSchema),
  existingSchedule: z.array(aiPlanScheduleItemInputSchema),
  deterministicSchedule: z.array(aiPlanScheduleItemInputSchema),
  unscheduledTasks: z.array(
    z.object({
      taskId: z.string(),
      reason: z.string(),
    })
  ),
});

export type AiPlanInput = z.infer<typeof aiPlanInputSchema>;

export const aiPlanSuggestionSchema = z.object({
  suggestedOrder: z
    .array(z.string())
    .describe(
      "Ordered list of task IDs. Must include exactly the task IDs from PLANNING_DATA tasks, no more and no less."
    ),
  notes: z.array(z.string().max(500)).max(5).optional(),
  warnings: z.array(z.string().max(500)).max(5).optional(),
});

export type AiPlanSuggestion = z.infer<typeof aiPlanSuggestionSchema>;

export interface AiPlanResult {
  suggestedOrder: string[];
  notes: string[];
  warnings: string[];
  aiGenerated: true;
}

export interface AiPlanningContext {
  tasks: Task[];
  availability: Array<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
  }>;
  existingItems: Array<{
    taskId: string | null;
    startTime: Date;
    endTime: Date;
  }>;
  deterministicSchedule: Array<{
    taskId: string;
    startTime: Date;
    endTime: Date;
  }>;
  unscheduledTasks: Array<{
    taskId: string;
    reason: string;
  }>;
  timezone: string;
  startDate: string;
  endDate: string;
  now: Date;
}
