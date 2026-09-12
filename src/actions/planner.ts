"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, gte, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { dailyPlan, scheduleItem, task, availability, user } from "@/db/schema";
import { requireAuth } from "@/lib/session";
import { safeErrorMessage } from "@/lib/error";
import {
  generatePlanSchema,
  updateScheduleItemStatusSchema,
  type GeneratePlanInput,
  type UpdateScheduleItemStatusInput,
} from "@/lib/validations/planner";
import { createTaskSchema } from "@/lib/validations/task";
import { confirmTaskProposalSchema, type ConfirmTaskProposalInput } from "@/lib/validations/proposal";
import { scheduleTasks } from "@/lib/scheduling/engine";
import type { ScheduleOutput, TimeWindow } from "@/lib/scheduling/types";
import { suggestAiPlanOrdering } from "@/lib/ai/suggest";
import type { AiPlanResult } from "@/lib/ai/schemas";
import { generateAiTaskProposal } from "@/lib/ai/propose-tasks";
import type { AiTaskProposalContext, AiTaskProposalResult } from "@/lib/ai/proposal-schemas";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface PlanWithItems {
  plan: typeof dailyPlan.$inferSelect;
  items: (typeof scheduleItem.$inferSelect & {
    task: typeof task.$inferSelect | null;
  })[];
}

export interface GeneratePlanResult extends ScheduleOutput {
  aiGenerated: boolean;
  aiNotes: string | null;
}

export type TaskProposalResult = AiTaskProposalResult;

export type ConfirmProposalResult = GeneratePlanResult;

export async function generatePlanAction(
  input: GeneratePlanInput
): Promise<ActionResult<GeneratePlanResult>> {
  return generatePlanInternal(input, { ai: false });
}

export async function generatePlanWithAIAction(
  input: GeneratePlanInput
): Promise<ActionResult<GeneratePlanResult>> {
  return generatePlanInternal(input, { ai: true });
}

interface GeneratePlanOptions {
  ai: boolean;
}

async function generatePlanInternal(
  input: GeneratePlanInput,
  options: GeneratePlanOptions
): Promise<ActionResult<GeneratePlanResult>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = generatePlanSchema.parse(input);

    const scheduleData = await buildScheduleData({
      userId,
      startDate: validated.startDate,
      endDate: validated.endDate,
    });

    let finalSchedule = scheduleData.baseSchedule;
    let aiResult: AiPlanResult | null = null;

    if (options.ai && scheduleData.eligibleTasks.length > 0) {
      aiResult = await suggestAiPlanOrdering({
        tasks: scheduleData.eligibleTasks,
        availability: scheduleData.availabilityBlocks,
        existingItems: scheduleData.existingItemsWithTask,
        deterministicSchedule: scheduleData.baseSchedule.scheduled,
        unscheduledTasks: scheduleData.baseSchedule.unscheduled.map((u) => ({
          taskId: u.task.id,
          reason: u.reason,
        })),
        timezone: scheduleData.timezone,
        startDate: validated.startDate,
        endDate: validated.endDate,
        now: scheduleData.now,
      });

      if (aiResult?.suggestedOrder) {
        finalSchedule = scheduleTasks({
          tasks: scheduleData.eligibleTasks,
          availability: scheduleData.availabilityBlocks,
          existingItems: scheduleData.existingItems,
          timezone: scheduleData.timezone,
          startDate: validated.startDate,
          endDate: validated.endDate,
          now: scheduleData.now,
          taskOrder: aiResult.suggestedOrder,
        });
      }
    }

    const planResult = await persistSchedule({
      userId,
      startDate: validated.startDate,
      endDate: validated.endDate,
      scheduleResult: finalSchedule,
      aiGenerated: aiResult !== null,
      aiNotes: aiResult ? formatAiNotes(aiResult.notes, aiResult.warnings) : null,
    });

    revalidatePath("/planner");
    return { success: true, data: planResult };
  } catch (error) {
    return {
      success: false,
      error: safeErrorMessage(
        error,
        options.ai ? "Failed to generate AI plan" : "Failed to generate plan"
      ),
    };
  }
}

interface BuildScheduleDataOptions {
  userId: string;
  startDate: string;
  endDate: string;
  taskOrder?: string[];
}

interface BuildScheduleDataOutput {
  eligibleTasks: typeof task.$inferSelect[];
  availabilityBlocks: (typeof availability.$inferSelect)[];
  existingItemsWithTask: Array<{ taskId: string | null; startTime: Date; endTime: Date }>;
  existingItems: TimeWindow[];
  baseSchedule: ScheduleOutput;
  timezone: string;
  now: Date;
}

async function buildScheduleData(options: BuildScheduleDataOptions): Promise<BuildScheduleDataOutput> {
  const { userId, startDate, endDate, taskOrder } = options;

  const [eligibleTasks, availabilityBlocks, existingPlansWithItems, userRecord] = await Promise.all([
    db.query.task.findMany({
      where: and(
        eq(task.userId, userId),
        or(eq(task.status, "TODO"), eq(task.status, "IN_PROGRESS"))
      ),
    }),
    db.query.availability.findMany({
      where: eq(availability.userId, userId),
    }),
    db.query.dailyPlan.findMany({
      where: and(
        eq(dailyPlan.userId, userId),
        gte(dailyPlan.date, startDate),
        lte(dailyPlan.date, endDate)
      ),
    }),
    db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { timezone: true },
    }),
  ]);

  const planIds = existingPlansWithItems.map((plan) => plan.id);
  const existingItemsWithTask: Array<{ taskId: string | null; startTime: Date; endTime: Date }> =
    planIds.length > 0
      ? await db
          .select({
            taskId: scheduleItem.taskId,
            startTime: scheduleItem.startTime,
            endTime: scheduleItem.endTime,
          })
          .from(scheduleItem)
          .where(
            and(
              eq(scheduleItem.status, "SCHEDULED"),
              or(...planIds.map((id) => eq(scheduleItem.dailyPlanId, id)))
            )
          )
      : [];

  const existingItems: TimeWindow[] = existingItemsWithTask.map((item) => ({
    start: item.startTime,
    end: item.endTime,
  }));

  const timezone = userRecord?.timezone ?? "UTC";
  const now = new Date();

  const baseScheduleResult = scheduleTasks({
    tasks: eligibleTasks,
    availability: availabilityBlocks,
    existingItems,
    timezone,
    startDate,
    endDate,
    now,
    taskOrder,
  });

  return {
    eligibleTasks,
    availabilityBlocks,
    existingItemsWithTask,
    existingItems,
    baseSchedule: baseScheduleResult,
    timezone,
    now,
  };
}

interface PersistScheduleOptions {
  userId: string;
  startDate: string;
  endDate: string;
  scheduleResult: ScheduleOutput;
  aiGenerated: boolean;
  aiNotes: string | null;
}

async function persistSchedule(options: PersistScheduleOptions): Promise<GeneratePlanResult> {
  const { userId, startDate, endDate, scheduleResult, aiGenerated, aiNotes } = options;

  const itemsByDate = new Map<string, typeof scheduleResult.scheduled>();
  for (const item of scheduleResult.scheduled) {
    const dateKey = toDateKey(item.startTime);
    const group = itemsByDate.get(dateKey) ?? [];
    group.push(item);
    itemsByDate.set(dateKey, group);
  }

  await db.transaction(async (tx) => {
    await tx.delete(dailyPlan).where(
      and(
        eq(dailyPlan.userId, userId),
        gte(dailyPlan.date, startDate),
        lte(dailyPlan.date, endDate)
      )
    );

    for (const [dateKey, items] of itemsByDate) {
      const [plan] = await tx
        .insert(dailyPlan)
        .values({
          userId,
          date: dateKey,
          aiGenerated,
          aiNotes,
        })
        .returning();

      if (!plan) {
        throw new Error("Failed to create daily plan");
      }

      if (items.length > 0) {
        await tx.insert(scheduleItem).values(
          items.map((item) => ({
            dailyPlanId: plan.id,
            taskId: item.taskId,
            startTime: item.startTime,
            endTime: item.endTime,
          }))
        );
      }
    }
  });

  return {
    ...scheduleResult,
    aiGenerated,
    aiNotes,
  };
}

const proposalRequestSchema = z.object({
  request: z.string().trim().min(1).max(2000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
});

export async function generateTaskProposalAction(
  input: unknown
): Promise<ActionResult<TaskProposalResult>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = proposalRequestSchema.parse(input);

    const [userTasks, availabilityBlocks, existingPlansWithItems, userRecord] = await Promise.all([
      db.query.task.findMany({
        where: eq(task.userId, userId),
      }),
      db.query.availability.findMany({
        where: eq(availability.userId, userId),
      }),
      db.query.dailyPlan.findMany({
        where: and(
          eq(dailyPlan.userId, userId),
          gte(dailyPlan.date, validated.startDate),
          lte(dailyPlan.date, validated.endDate)
        ),
      }),
      db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { timezone: true },
      }),
    ]);

    const planIds = existingPlansWithItems.map((plan) => plan.id);
    const existingItems =
      planIds.length > 0
        ? await db
            .select({
              taskId: scheduleItem.taskId,
              startTime: scheduleItem.startTime,
              endTime: scheduleItem.endTime,
            })
            .from(scheduleItem)
            .where(
              and(
                eq(scheduleItem.status, "SCHEDULED"),
                or(...planIds.map((id) => eq(scheduleItem.dailyPlanId, id)))
              )
            )
        : [];

    const timezone = userRecord?.timezone ?? "UTC";
    const now = new Date();

    const context: AiTaskProposalContext = {
      currentDate: toDateString(now),
      currentTime: toTimeString(now),
      timezone,
      dateRange: { start: validated.startDate, end: validated.endDate },
      request: validated.request,
      tasks: userTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority as AiTaskProposalContext["tasks"][number]["priority"],
        status: t.status as AiTaskProposalContext["tasks"][number]["status"],
        estimatedMinutes: t.estimatedMinutes,
        deadline: t.deadline?.toISOString() ?? null,
      })),
      availability: availabilityBlocks.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      existingSchedule: existingItems.map((item) => ({
        taskId: item.taskId ?? "",
        startTime: item.startTime.toISOString(),
        endTime: item.endTime.toISOString(),
      })),
    };

    const proposal = await generateAiTaskProposal(context);

    if (!proposal) {
      return { success: false, error: "Could not generate a proposal. Please try again." };
    }

    const taskTitles = new Map(userTasks.map((t) => [t.id, t.title]));
    const proposalWithTitles: TaskProposalResult = {
      ...proposal,
      items: proposal.items.map((item) =>
        item.type === "existing" ? { ...item, title: taskTitles.get(item.taskId) ?? item.taskId } : item
      ),
    };

    return { success: true, data: proposalWithTitles };
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to generate proposal") };
  }
}

export async function confirmTaskProposalAction(
  input: ConfirmTaskProposalInput
): Promise<ActionResult<ConfirmProposalResult>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = confirmTaskProposalSchema.parse(input);

    const existingUserTasks = await db.query.task.findMany({
      where: eq(task.userId, userId),
      columns: { id: true },
    });
    const userTaskIds = new Set(existingUserTasks.map((t) => t.id));
    const referencedIds = new Set<string>();

    for (const item of validated.items) {
      if (item.type === "existing") {
        if (!userTaskIds.has(item.taskId)) {
          return { success: false, error: "Proposal references an unknown task" };
        }
        if (referencedIds.has(item.taskId)) {
          return { success: false, error: "Proposal references the same task more than once" };
        }
        referencedIds.add(item.taskId);
      } else {
        const taskValidation = createTaskSchema.safeParse({
          title: item.title,
          description: item.description,
          priority: item.priority,
          status: "TODO",
          estimatedMinutes: item.estimatedMinutes,
          deadline: item.deadline,
        });
        if (!taskValidation.success) {
          return { success: false, error: "Proposal contains an invalid new task" };
        }
      }
    }

    await db.transaction(async (tx) => {
      for (const item of validated.items) {
        if (item.type === "new") {
          const [created] = await tx
            .insert(task)
            .values({
              userId,
              title: item.title,
              description: item.description,
              priority: item.priority,
              status: "TODO",
              estimatedMinutes: item.estimatedMinutes,
              deadline: item.deadline ? new Date(item.deadline) : null,
            })
            .returning({ id: task.id });

          if (!created) {
            throw new Error("Failed to create task");
          }
        }
      }
    });

    const scheduleData = await buildScheduleData({
      userId,
      startDate: validated.startDate,
      endDate: validated.endDate,
    });

    const planResult = await persistSchedule({
      userId,
      startDate: validated.startDate,
      endDate: validated.endDate,
      scheduleResult: scheduleData.baseSchedule,
      aiGenerated: false,
      aiNotes: null,
    });

    revalidatePath("/planner");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return { success: true, data: planResult };
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to confirm proposal") };
  }
}

export async function getPlansForRangeQuery(
  startDate: string,
  endDate: string
): Promise<ActionResult<PlanWithItems[]>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const plans = await db.query.dailyPlan.findMany({
      where: and(
        eq(dailyPlan.userId, userId),
        gte(dailyPlan.date, startDate),
        lte(dailyPlan.date, endDate)
      ),
      orderBy: dailyPlan.date,
    });

    const planIds = plans.map((plan) => plan.id);
    const items =
      planIds.length > 0
        ? await db
            .select()
            .from(scheduleItem)
            .leftJoin(task, eq(scheduleItem.taskId, task.id))
            .where(or(...planIds.map((id) => eq(scheduleItem.dailyPlanId, id))))
        : [];

    const itemsByPlanId = new Map<string, PlanWithItems["items"]>();
    for (const row of items) {
      const item = row.schedule_item;
      const linkedTask = row.task;
      const group = itemsByPlanId.get(item.dailyPlanId) ?? [];
      group.push({ ...item, task: linkedTask });
      itemsByPlanId.set(item.dailyPlanId, group);
    }

    const result: PlanWithItems[] = plans.map((plan) => ({
      plan,
      items: itemsByPlanId.get(plan.id) ?? [],
    }));

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to load plans") };
  }
}

export async function deletePlanAction(id: string): Promise<ActionResult<void>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const plan = await db.query.dailyPlan.findFirst({
      where: eq(dailyPlan.id, id),
    });

    if (!plan || plan.userId !== userId) {
      return { success: false, error: "Plan not found" };
    }

    await db.delete(dailyPlan).where(eq(dailyPlan.id, id));
    revalidatePath("/planner");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to delete plan") };
  }
}

export async function updateScheduleItemStatusAction(
  id: string,
  input: UpdateScheduleItemStatusInput
): Promise<ActionResult<void>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = updateScheduleItemStatusSchema.parse(input);

    const item = await db.query.scheduleItem.findFirst({
      where: eq(scheduleItem.id, id),
    });

    if (!item) {
      return { success: false, error: "Schedule item not found" };
    }

    const plan = await db.query.dailyPlan.findFirst({
      where: eq(dailyPlan.id, item.dailyPlanId),
    });

    if (!plan || plan.userId !== userId) {
      return { success: false, error: "Schedule item not found" };
    }

    await db
      .update(scheduleItem)
      .set({ status: validated.status, updatedAt: new Date() })
      .where(eq(scheduleItem.id, id));

    revalidatePath("/planner");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to update schedule item") };
  }
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatAiNotes(notes: string[], warnings: string[]): string | null {
  const parts: string[] = [];
  if (notes.length > 0) {
    parts.push(notes.join(" "));
  }
  if (warnings.length > 0) {
    parts.push(`Warnings: ${warnings.join(" ")}`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
