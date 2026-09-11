"use server";

import { revalidatePath } from "next/cache";
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
import { scheduleTasks } from "@/lib/scheduling/engine";
import type { ScheduleOutput, TimeWindow } from "@/lib/scheduling/types";
import { suggestAiPlanOrdering } from "@/lib/ai/suggest";
import type { AiPlanResult } from "@/lib/ai/schemas";

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

    const [eligibleTasks, availabilityBlocks, existingPlansWithItems] = await Promise.all([
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
          gte(dailyPlan.date, validated.startDate),
          lte(dailyPlan.date, validated.endDate)
        ),
      }),
    ]);

    const planIds = existingPlansWithItems.map((plan) => plan.id);
    const existingItemsWithTask: Array<{
      taskId: string | null;
      startTime: Date;
      endTime: Date;
    }> =
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

    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { timezone: true },
    });

    const timezone = userRecord?.timezone ?? "UTC";
    const now = new Date();

    const baseScheduleResult = scheduleTasks({
      tasks: eligibleTasks,
      availability: availabilityBlocks,
      existingItems,
      timezone,
      startDate: validated.startDate,
      endDate: validated.endDate,
      now,
    });

    let aiResult: AiPlanResult | null = null;

    if (options.ai && eligibleTasks.length > 0) {
      aiResult = await suggestAiPlanOrdering({
        tasks: eligibleTasks,
        availability: availabilityBlocks,
        existingItems: existingItemsWithTask,
        deterministicSchedule: baseScheduleResult.scheduled,
        unscheduledTasks: baseScheduleResult.unscheduled.map((u) => ({
          taskId: u.task.id,
          reason: u.reason,
        })),
        timezone,
        startDate: validated.startDate,
        endDate: validated.endDate,
        now,
      });
    }

    const finalScheduleResult =
      aiResult?.suggestedOrder
        ? scheduleTasks({
            tasks: eligibleTasks,
            availability: availabilityBlocks,
            existingItems,
            timezone,
            startDate: validated.startDate,
            endDate: validated.endDate,
            now,
            taskOrder: aiResult.suggestedOrder,
          })
        : baseScheduleResult;

    const aiGenerated = aiResult !== null;
    const aiNotes = aiResult
      ? formatAiNotes(aiResult.notes, aiResult.warnings)
      : null;

    // Group scheduled items by date key so we can create one DailyPlan per date.
    const itemsByDate = new Map<string, typeof finalScheduleResult.scheduled>();
    for (const item of finalScheduleResult.scheduled) {
      const dateKey = toDateKey(item.startTime);
      const group = itemsByDate.get(dateKey) ?? [];
      group.push(item);
      itemsByDate.set(dateKey, group);
    }

    await db.transaction(async (tx) => {
      // Remove existing plans in the range first.
      await tx.delete(dailyPlan).where(
        and(
          eq(dailyPlan.userId, userId),
          gte(dailyPlan.date, validated.startDate),
          lte(dailyPlan.date, validated.endDate)
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

    revalidatePath("/planner");
    return {
      success: true,
      data: {
        ...finalScheduleResult,
        aiGenerated,
        aiNotes,
      },
    };
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
