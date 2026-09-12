import { z } from "zod";
import { TaskPriority } from "./task";

const existingConfirmItemSchema = z.object({
  type: z.literal("existing"),
  taskId: z.string(),
  reason: z.string().max(500),
});

const newConfirmItemSchema = z.object({
  type: z.literal("new"),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().default(null),
  priority: TaskPriority,
  estimatedMinutes: z.number().int().positive().max(1440),
  deadline: z.string().datetime().nullable().default(null),
  reason: z.string().max(500),
});

/**
 * Client-to-server schema for confirming a task proposal.
 *
 * This is intentionally permissive about the shape so the UI can submit an
 * edited proposal; server actions re-validate ownership and business rules
 * before writing anything to the database.
 */
export const confirmTaskProposalSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  items: z.array(z.union([existingConfirmItemSchema, newConfirmItemSchema])).max(50),
});

export type ConfirmTaskProposalInput = z.infer<typeof confirmTaskProposalSchema>;
