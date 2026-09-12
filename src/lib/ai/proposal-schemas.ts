import { z } from "zod";

export const TaskPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

/**
 * Task information included in the context sent to the proposal model.
 * Mirrors the shape used by the plan-suggestion feature for consistency.
 */
export const aiContextTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  priority: TaskPriority,
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  estimatedMinutes: z.number().nullable(),
  deadline: z.string().datetime().nullable(),
});

export type AiContextTask = z.infer<typeof aiContextTaskSchema>;

export const aiContextAvailabilitySchema = z.object({
  dayOfWeek: z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]),
  startTime: z.string(),
  endTime: z.string(),
});

export type AiContextAvailability = z.infer<typeof aiContextAvailabilitySchema>;

export const aiContextExistingItemSchema = z.object({
  taskId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export type AiContextExistingItem = z.infer<typeof aiContextExistingItemSchema>;

/**
 * Context provided to the AI task-proposal feature.
 */
export const aiTaskProposalContextSchema = z.object({
  currentDate: z.string(),
  currentTime: z.string(),
  timezone: z.string(),
  dateRange: z.object({ start: z.string(), end: z.string() }),
  request: z.string().max(2000),
  tasks: z.array(aiContextTaskSchema),
  availability: z.array(aiContextAvailabilitySchema),
  existingSchedule: z.array(aiContextExistingItemSchema),
});

export type AiTaskProposalContext = z.infer<typeof aiTaskProposalContextSchema>;

const existingProposalItemSchema = z.object({
  type: z.literal("existing"),
  taskId: z.string(),
  title: z.string().optional(),
  reason: z.string().max(500),
});

const newProposalItemSchema = z.object({
  type: z.literal("new"),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().default(null),
  priority: TaskPriority.default("MEDIUM"),
  estimatedMinutes: z.number().int().positive().max(1440),
  deadline: z.string().datetime().nullable().default(null),
  reason: z.string().max(500),
});

/**
 * Raw AI response shape for a task proposal.
 */
export const aiTaskProposalSchema = z.object({
  items: z.array(z.union([existingProposalItemSchema, newProposalItemSchema])).max(50),
  notes: z.array(z.string().max(500)).max(10).default([]),
  warnings: z.array(z.string().max(500)).max(10).default([]),
});

export type AiTaskProposal = z.infer<typeof aiTaskProposalSchema>;

export type ExistingProposalItem = z.infer<typeof existingProposalItemSchema>;
export type NewProposalItem = z.infer<typeof newProposalItemSchema>;
export type ProposalItem = ExistingProposalItem | NewProposalItem;

/**
 * Public result returned after a proposal is generated and validated.
 */
export interface AiTaskProposalResult {
  items: ProposalItem[];
  notes: string[];
  warnings: string[];
}
