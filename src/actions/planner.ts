"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, notExists, or } from "drizzle-orm";
import { db } from "@/db";
import { dailyPlan, scheduleItem, studySession, task, availability, user } from "@/db/schema";
import { requireAuth } from "@/lib/session";
import { safeErrorMessage } from "@/lib/error";
import { ownSubjectId, ownTaskMilestoneId } from "@/lib/study/ownership";
import { countsAsStudy } from "@/lib/study/progress";
import {
  generatePlanSchema,
  updateScheduleItemStatusSchema,
  type GeneratePlanInput,
  type UpdateScheduleItemStatusInput,
} from "@/lib/validations/planner";
import { createTaskSchema } from "@/lib/validations/task";
import { confirmTaskProposalSchema, type ConfirmTaskProposalInput } from "@/lib/validations/proposal";
import { scheduleTasks } from "@/lib/scheduling/engine";
import { buildBusyWindows, groupScheduledItemsByLocalDate } from "@/lib/scheduling/plan-utils";
import { addDaysToDateKey, toLocalDateKey, toLocalTimeString } from "@/lib/scheduling/timezone";
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
        existingItems: scheduleData.busyItemsWithTask,
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
      timezone: scheduleData.timezone,
      scheduleResult: finalSchedule,
      aiGenerated: aiResult !== null,
      aiNotes: aiResult ? formatAiNotes(aiResult.notes, aiResult.warnings) : null,
    });

    revalidatePlannerViews();
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
  /** Plan only these tasks; every other task keeps its existing slots. */
  onlyTaskIds?: string[];
}

interface BuildScheduleDataOutput {
  eligibleTasks: typeof task.$inferSelect[];
  availabilityBlocks: (typeof availability.$inferSelect)[];
  /** Items that survive regeneration (completed or skipped) and still occupy their time. */
  busyItemsWithTask: Array<{ taskId: string | null; startTime: Date; endTime: Date }>;
  existingItems: TimeWindow[];
  baseSchedule: ScheduleOutput;
  timezone: string;
  now: Date;
}

async function buildScheduleData(options: BuildScheduleDataOptions): Promise<BuildScheduleDataOutput> {
  const { userId, startDate, endDate, taskOrder } = options;
  const only = options.onlyTaskIds ? new Set(options.onlyTaskIds) : undefined;
  const now = new Date();

  const [openTasks, availabilityBlocks, existingPlansWithItems, userRecord, scheduledElsewhere] = await Promise.all([
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
    // Tasks that already have an upcoming block on a day outside this range.
    db
      .select({ taskId: scheduleItem.taskId })
      .from(scheduleItem)
      .innerJoin(dailyPlan, eq(scheduleItem.dailyPlanId, dailyPlan.id))
      .where(
        and(
          eq(dailyPlan.userId, userId),
          eq(scheduleItem.status, "SCHEDULED"),
          gt(scheduleItem.endTime, now),
          or(lt(dailyPlan.date, startDate), gt(dailyPlan.date, endDate))
        )
      ),
  ]);

  // Planning a range must not schedule a task a second time when it is already
  // planned on another upcoming day.
  const alreadyPlanned = new Set(scheduledElsewhere.map((row) => row.taskId));
  const eligibleTasks = openTasks.filter((t) => !alreadyPlanned.has(t.id) && (!only || only.has(t.id)));

  const planIds = existingPlansWithItems.map((plan) => plan.id);
  const itemsInRange =
    planIds.length > 0
      ? await db
          .select({
            taskId: scheduleItem.taskId,
            status: scheduleItem.status,
            startTime: scheduleItem.startTime,
            endTime: scheduleItem.endTime,
          })
          .from(scheduleItem)
          .where(inArray(scheduleItem.dailyPlanId, planIds))
      : [];

  // Items still SCHEDULED are about to be replaced, so they must not block
  // their own slots. Completed/skipped items are kept and stay busy, and so do
  // scheduled items of tasks outside `onlyTaskIds`.
  const staysBusy = (item: (typeof itemsInRange)[number]) =>
    item.status !== "SCHEDULED" || (only !== undefined && !only.has(item.taskId ?? ""));
  const busyItemsWithTask = itemsInRange
    .filter(staysBusy)
    .map(({ taskId, startTime, endTime }) => ({ taskId, startTime, endTime }));
  const existingItems: TimeWindow[] = buildBusyWindows(itemsInRange, only);

  const timezone = userRecord?.timezone ?? "UTC";

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
    busyItemsWithTask,
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
  timezone: string;
  scheduleResult: ScheduleOutput;
  aiGenerated: boolean;
  aiNotes: string | null;
  /** Replace only these tasks' scheduled items; leave every other item in place. */
  onlyTaskIds?: string[];
}

/**
 * Replaces the SCHEDULED items in the date range with a new schedule.
 *
 * Completed and skipped items are kept, so regenerating never erases what the
 * user already did. Each day reuses its existing DailyPlan when there is one,
 * and plans left with no items are removed.
 */
async function persistSchedule(options: PersistScheduleOptions): Promise<GeneratePlanResult> {
  const { userId, startDate, endDate, timezone, scheduleResult, aiGenerated, aiNotes, onlyTaskIds } = options;

  const itemsByDate = groupScheduledItemsByLocalDate(scheduleResult.scheduled, timezone);
  const inRange = and(
    eq(dailyPlan.userId, userId),
    gte(dailyPlan.date, startDate),
    lte(dailyPlan.date, endDate)
  );

  await db.transaction(async (tx) => {
    const plansInRange = await tx.query.dailyPlan.findMany({ where: inRange });
    const planIds = plansInRange.map((plan) => plan.id);

    if (planIds.length > 0) {
      await tx
        .delete(scheduleItem)
        .where(
          and(
            inArray(scheduleItem.dailyPlanId, planIds),
            eq(scheduleItem.status, "SCHEDULED"),
            onlyTaskIds ? inArray(scheduleItem.taskId, onlyTaskIds.length > 0 ? onlyTaskIds : [""]) : undefined
          )
        );
    }

    const planIdByDate = new Map<string, string>();
    for (const plan of plansInRange) {
      if (!planIdByDate.has(plan.date)) {
        planIdByDate.set(plan.date, plan.id);
      }
    }

    for (const [dateKey, items] of itemsByDate) {
      let planId = planIdByDate.get(dateKey);

      if (planId) {
        await tx
          .update(dailyPlan)
          .set({ aiGenerated, aiNotes, updatedAt: new Date() })
          .where(eq(dailyPlan.id, planId));
      } else {
        const [plan] = await tx
          .insert(dailyPlan)
          .values({ userId, date: dateKey, aiGenerated, aiNotes })
          .returning({ id: dailyPlan.id });

        if (!plan) {
          throw new Error("Failed to create daily plan");
        }
        planId = plan.id;
      }

      await tx.insert(scheduleItem).values(
        items.map((item) => ({
          dailyPlanId: planId,
          taskId: item.taskId,
          startTime: item.startTime,
          endTime: item.endTime,
        }))
      );
    }

    await tx
      .delete(dailyPlan)
      .where(
        and(
          inRange,
          notExists(
            tx.select({ id: scheduleItem.id }).from(scheduleItem).where(eq(scheduleItem.dailyPlanId, dailyPlan.id))
          )
        )
      );
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
      currentDate: toLocalDateKey(now, timezone),
      currentTime: toLocalTimeString(now, timezone),
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

    // Task ids in the order the user confirmed them; only these are planned.
    const proposalTaskIds: string[] = [];

    await db.transaction(async (tx) => {
      for (const item of validated.items) {
        if (item.type === "existing") {
          proposalTaskIds.push(item.taskId);
        } else {
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
          proposalTaskIds.push(created.id);
        }
      }
    });

    // Plan only what the user kept in the proposal, in that order. Tasks they
    // removed, and every other task, keep whatever slots they already had.
    const scheduleData = await buildScheduleData({
      userId,
      startDate: validated.startDate,
      endDate: validated.endDate,
      onlyTaskIds: proposalTaskIds,
      taskOrder: proposalTaskIds,
    });

    const planResult = await persistSchedule({
      userId,
      startDate: validated.startDate,
      endDate: validated.endDate,
      timezone: scheduleData.timezone,
      scheduleResult: scheduleData.baseSchedule,
      aiGenerated: false,
      aiNotes: null,
      onlyTaskIds: proposalTaskIds,
    });

    revalidatePlannerViews();
    revalidatePath("/tasks");

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
    // Same rules as planning: valid YYYY-MM-DD dates, in order, at most 30 days.
    const range = generatePlanSchema.safeParse({ startDate, endDate });
    if (!range.success) {
      return { success: false, error: range.error.issues[0]?.message ?? "Invalid date range" };
    }

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
    revalidatePlannerViews();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to delete plan") };
  }
}

export async function updateScheduleItemStatusAction(
  id: string,
  input: UpdateScheduleItemStatusInput
): Promise<ActionResult<{ studySessionId: string | null }>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const validated = updateScheduleItemStatusSchema.parse(input);
    let studySessionId: string | null = null;

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

    await db.transaction(async (tx) => {
      const updatedAt = new Date();
      await tx
        .update(scheduleItem)
        .set({ status: validated.status, updatedAt })
        .where(eq(scheduleItem.id, id));

      // Keep the task in step with its block: finishing the block finishes the
      // task, and undoing it reopens a task that was completed.
      if (item.taskId) {
        const ownTask = and(eq(task.id, item.taskId), eq(task.userId, userId));
        if (validated.status === "COMPLETED") {
          await tx.update(task).set({ status: "COMPLETED", updatedAt }).where(ownTask);
        } else if (validated.status === "SCHEDULED") {
          await tx
            .update(task)
            .set({ status: "TODO", updatedAt })
            .where(and(ownTask, eq(task.status, "COMPLETED")));
        }
      }

      // Study log: a finished study block ("Add to my plan") counts as studied
      // time, unless a timer already covered the same task at that time. Other
      // tasks (submissions, project deadlines) are to-dos: finishing one is not
      // learning progress, so nothing is logged.
      if (validated.status === "COMPLETED") {
        const linkedTask = item.taskId
          ? await tx.query.task.findFirst({
              where: and(eq(task.id, item.taskId), eq(task.userId, userId)),
              columns: { subjectId: true, title: true },
            })
          : null;
        const overlappingTimer = countsAsStudy(linkedTask?.title) && item.taskId
          ? await tx.query.studySession.findFirst({
              where: and(
                eq(studySession.userId, userId),
                eq(studySession.taskId, item.taskId),
                eq(studySession.source, "TIMER"),
                lt(studySession.startedAt, item.endTime),
                or(isNull(studySession.endedAt), gt(studySession.endedAt, item.startTime))
              ),
              columns: { id: true },
            })
          : null;

        if (countsAsStudy(linkedTask?.title) && !overlappingTimer) {
          const minutes = Math.round((item.endTime.getTime() - item.startTime.getTime()) / 60_000);
          await tx
            .insert(studySession)
            .values({
              userId,
              subjectId: linkedTask?.subjectId ?? null,
              taskId: item.taskId,
              scheduleItemId: item.id,
              startedAt: item.startTime,
              endedAt: item.endTime,
              minutes,
              source: "BLOCK",
            })
            .onConflictDoNothing({ target: studySession.scheduleItemId });
          const logged = await tx.query.studySession.findFirst({
            where: and(eq(studySession.scheduleItemId, item.id), eq(studySession.userId, userId)),
            columns: { id: true },
          });
          studySessionId = logged?.id ?? null;
        }
      } else {
        await tx
          .delete(studySession)
          .where(
            and(
              eq(studySession.scheduleItemId, item.id),
              eq(studySession.userId, userId),
              eq(studySession.source, "BLOCK")
            )
          );
      }
    });

    revalidatePlannerViews();
    revalidatePath("/progress");
    return { success: true, data: { studySessionId } };
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to update schedule item") };
  }
}

function revalidatePlannerViews() {
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/tasks");
}

export interface TodayData {
  timezone: string;
  today: string;
  items: PlanWithItems["items"];
  deadlines: (typeof task.$inferSelect)[];
  unplanned: (typeof task.$inferSelect)[];
  hasAvailability: boolean;
}

/**
 * Everything the Today screen needs, in one round of queries.
 */
export async function getTodayQuery(): Promise<TodayData> {
  const session = await requireAuth();
  const userId = session.user.id;
  const now = new Date();

  const [userRecord, availabilityCount] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId), columns: { timezone: true } }),
    db.$count(availability, eq(availability.userId, userId)),
  ]);
  const timezone = userRecord?.timezone ?? "UTC";
  const today = toLocalDateKey(now, timezone);
  const deadlineHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [todayRows, openTasks, upcomingTaskIds] = await Promise.all([
    db
      .select()
      .from(scheduleItem)
      .innerJoin(dailyPlan, eq(scheduleItem.dailyPlanId, dailyPlan.id))
      .leftJoin(task, eq(scheduleItem.taskId, task.id))
      .where(and(eq(dailyPlan.userId, userId), eq(dailyPlan.date, today)))
      .orderBy(asc(scheduleItem.startTime)),
    db.query.task.findMany({
      where: and(eq(task.userId, userId), or(eq(task.status, "TODO"), eq(task.status, "IN_PROGRESS"))),
      orderBy: [asc(task.deadline), asc(task.createdAt)],
    }),
    db
      .selectDistinct({ taskId: scheduleItem.taskId })
      .from(scheduleItem)
      .innerJoin(dailyPlan, eq(scheduleItem.dailyPlanId, dailyPlan.id))
      .where(
        and(
          eq(dailyPlan.userId, userId),
          eq(scheduleItem.status, "SCHEDULED"),
          gt(scheduleItem.endTime, now),
          isNotNull(scheduleItem.taskId)
        )
      ),
  ]);

  const planned = new Set(upcomingTaskIds.map((row) => row.taskId));

  return {
    timezone,
    today,
    items: todayRows.map((row) => ({ ...row.schedule_item, task: row.task })),
    deadlines: openTasks.filter((t) => t.deadline && t.deadline <= deadlineHorizon),
    unplanned: openTasks.filter((t) => !planned.has(t.id)),
    hasAvailability: availabilityCount > 0,
  };
}

/** Today through today + 6 in the user's timezone: the window Today and Week plan into. */
function weekRangeFor(timezone: string): { startDate: string; endDate: string } {
  const startDate = toLocalDateKey(new Date(), timezone);
  return { startDate, endDate: addDaysToDateKey(startDate, 6) };
}

/**
 * Replans the coming week (today to today + 6). Used by "Replan" on Today and
 * after quick-add.
 */
export async function replanWeekAction(): Promise<ActionResult<GeneratePlanResult>> {
  try {
    const session = await requireAuth();
    const record = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { timezone: true },
    });
    return await generatePlanInternal(weekRangeFor(record?.timezone ?? "UTC"), { ai: false });
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to replan") };
  }
}

export interface QuickAddOutcome {
  taskId: string;
  title: string;
  plannedAt: Date | null;
  notPlannedReason: string | null;
}

/**
 * Creates a task from quick-add and immediately plans it into the coming week.
 * The task is saved even if planning fails; the outcome says what happened.
 */
export async function quickAddTaskAction(input: unknown): Promise<ActionResult<QuickAddOutcome>> {
  try {
    const session = await requireAuth();
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { success: false, error: first?.message ?? "Check the task details" };
    }

    const subjectId = await ownSubjectId(session.user.id, parsed.data.subjectId);
    const milestoneId = await ownTaskMilestoneId(session.user.id, parsed.data.milestoneId, subjectId);

    const [created] = await db
      .insert(task)
      .values({
        userId: session.user.id,
        subjectId,
        milestoneId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        priority: parsed.data.priority,
        status: "TODO",
        estimatedMinutes: parsed.data.estimatedMinutes ?? null,
        deadline: parsed.data.deadline ?? null,
      })
      .returning();

    if (!created) {
      return { success: false, error: "Failed to add task" };
    }

    const planned = await replanWeekAction();
    let plannedAt: Date | null = null;
    let notPlannedReason: string | null = null;

    if (planned.success) {
      plannedAt = planned.data.scheduled.find((item) => item.taskId === created.id)?.startTime ?? null;
      if (!plannedAt) {
        notPlannedReason =
          planned.data.unscheduled.find((u) => u.task.id === created.id)?.reason ??
          "Already planned or outside this week";
      }
    } else {
      notPlannedReason = planned.error;
    }

    revalidatePlannerViews();
    return {
      success: true,
      data: { taskId: created.id, title: created.title, plannedAt, notPlannedReason },
    };
  } catch (error) {
    return { success: false, error: safeErrorMessage(error, "Failed to add task") };
  }
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
