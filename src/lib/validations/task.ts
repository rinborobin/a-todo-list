import { z } from "zod";

export const TaskPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const TaskStatus = z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

const deadlineSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === "") return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return val;
}, z.date({ message: "Invalid date format" }).optional().nullable());

const estimatedMinutesSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === "") return null;
  const parsed = Number(val);
  return isNaN(parsed) ? val : parsed;
}, z.number().int("Estimated minutes must be an integer").positive("Estimated duration must be greater than 0").max(1440, "Estimated duration cannot exceed 24 hours (1440 minutes)").optional().nullable());

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  priority: TaskPriority.default("MEDIUM"),
  status: TaskStatus.default("TODO"),
  estimatedMinutes: estimatedMinutesSchema,
  deadline: deadlineSchema,
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(200, "Title cannot exceed 200 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  priority: TaskPriority.optional(),
  status: TaskStatus.optional(),
  estimatedMinutes: estimatedMinutesSchema,
  deadline: deadlineSchema,
});

export const taskFilterSchema = z.object({
  status: TaskStatus.or(z.literal("ALL")).optional().default("ALL"),
  priority: TaskPriority.or(z.literal("ALL")).optional().default("ALL"),
  search: z.string().trim().optional(),
  sortBy: z.enum(["deadline", "priority", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type TaskFilterInput = z.input<typeof taskFilterSchema>;