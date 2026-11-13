"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  milestone,
  studySession,
  subject,
  task,
  topic,
  user,
  type Milestone,
  type StudySession,
  type Subject,
  type Task,
  type Topic,
} from "@/db/schema";
import { requireAuth } from "@/lib/session";
import { UserFacingError, safeErrorMessage } from "@/lib/error";
import { ownMilestone, ownSubjectId, ownTask, ownTopic } from "@/lib/study/ownership";
import { addDaysToDateKey, localDateTimeToUtc, toLocalDateKey } from "@/lib/scheduling/timezone";
import {
  advanceResourceSchema,
  createMilestoneSchema,
  createSubjectSchema,
  updateMilestoneSchema,
  logStudySessionSchema,
  rateSessionSchema,
  renameSubjectSchema,
  renameTopicSchema,
  setGoalSchema,
  setSessionTopicSchema,
  planStudyBlockSchema,
  startTimerSchema,
  subjectSetupSchema,
  type topicChoiceSchema,
} from "@/lib/validations/study";
import type { z } from "zod";
import { defaultGoalMinutes } from "@/lib/study/focus-time";
import { quickAddTaskAction, replanWeekAction } from "@/actions/planner";
import { rankStudyNext, type StudyNextSuggestion } from "@/lib/study/next";
import { summarizeStudy } from "@/lib/study/stats";
import { replayMemory, reviewStatus } from "@/lib/study/memory";
import { estimateRatio, typicalMinutes, usualHours } from "@/lib/study/habits";
import { suggestStudyNextWithAi } from "@/lib/ai/study-next";
import { currentMilestone, milestoneProgress, resourceProgress } from "@/lib/study/progress";
import { describeStreak, practiceStreak } from "@/lib/study/streak";
import type { StudyNextAiContext } from "@/lib/ai/study-next-schemas";

export type ActionResult<T = unknown> = { success: true; data: T } | { success: false; error: string };

const MAX_TIMER_MINUTES = 480;
const MANUAL_LOG_MAX_DAYS_BACK = 60;

function isUniqueViolation(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown })?.cause];
  return candidates.some((e) => (e as { code?: string })?.code === "23505");
}

function revalidateStudyViews() {
  revalidatePath("/today");
  revalidatePath("/progress");
  revalidatePath("/tasks");
  revalidatePath("/me");
  revalidatePath("/focus");
  revalidatePath("/setup");
}

async function userTimezone(userId: string): Promise<string> {
  const record = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { timezone: true } });
  return record?.timezone ?? "UTC";
}

// ---------------------------------------------------------------- subjects

export async function listSubjectsQuery(): Promise<Subject[]> {
  const session = await requireAuth();
  return db.query.subject.findMany({
    where: eq(subject.userId, session.user.id),
    orderBy: [asc(subject.name)],
  });
}

export async function createSubjectAction(input: unknown): Promise<ActionResult<Subject>> {
  try {
    const session = await requireAuth();
    const parsed = createSubjectSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };

    const [created] = await db
      .insert(subject)
      .values({ userId: session.user.id, name: parsed.data.name, kind: parsed.data.kind ?? "CLASS" })
      .returning();
    revalidateStudyViews();
    return { success: true, data: created };
  } catch (err) {
    if (isUniqueViolation(err)) return { success: false, error: "You already have a subject with that name" };
    return { success: false, error: safeErrorMessage(err, "Could not add the subject") };
  }
}

export async function renameSubjectAction(input: unknown): Promise<ActionResult<Subject>> {
  try {
    const session = await requireAuth();
    const parsed = renameSubjectSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };

    const [updated] = await db
      .update(subject)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(and(eq(subject.id, parsed.data.id), eq(subject.userId, session.user.id)))
      .returning();
    if (!updated) return { success: false, error: "Subject not found" };
    revalidateStudyViews();
    return { success: true, data: updated };
  } catch (err) {
    if (isUniqueViolation(err)) return { success: false, error: "You already have a subject with that name" };
    return { success: false, error: safeErrorMessage(err, "Could not rename the subject") };
  }
}

/**
 * Saves what the student told us about a subject during setup: its kind,
 * confidence, exam or target date, weekly goal, practice days and the book or
 * course being worked through. Only the fields that are sent are changed.
 */
export async function updateSubjectSetupAction(input: unknown): Promise<ActionResult<Subject>> {
  try {
    const session = await requireAuth();
    const parsed = subjectSetupSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
    const { id, ...fields } = parsed.data;

    const existing = await db.query.subject.findFirst({
      where: and(eq(subject.id, id), eq(subject.userId, session.user.id)),
      columns: { resourceTotal: true, resourceDone: true },
    });
    if (!existing) return { success: false, error: "Subject not found" };

    const changes: Partial<typeof subject.$inferInsert> = { updatedAt: new Date() };
    if (fields.kind !== undefined) changes.kind = fields.kind;
    if (fields.confidence !== undefined) changes.confidence = fields.confidence;
    if (fields.examDate !== undefined) changes.examDate = fields.examDate;
    if (fields.weeklyGoalMinutes !== undefined) changes.weeklyGoalMinutes = fields.weeklyGoalMinutes;
    if (fields.practiceDaysPerWeek !== undefined) changes.practiceDaysPerWeek = fields.practiceDaysPerWeek;
    if (fields.resourceName !== undefined) changes.resourceName = fields.resourceName;
    if (fields.resourceUnit !== undefined) changes.resourceUnit = fields.resourceUnit?.toLowerCase() ?? null;
    if (fields.resourceTotal !== undefined) changes.resourceTotal = fields.resourceTotal;
    if (fields.resourceDone !== undefined) changes.resourceDone = fields.resourceDone;
    // Never more done than there are units.
    const total = changes.resourceTotal !== undefined ? changes.resourceTotal : existing.resourceTotal;
    const done = changes.resourceDone ?? existing.resourceDone;
    if (total !== null && total !== undefined && done > total) changes.resourceDone = total;

    const [updated] = await db
      .update(subject)
      .set(changes)
      .where(and(eq(subject.id, id), eq(subject.userId, session.user.id)))
      .returning();
    if (!updated) return { success: false, error: "Subject not found" };
    revalidateStudyViews();
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not save the subject") };
  }
}

/** Archive hides the subject from pickers but keeps its history. Pass false to restore. */
export async function archiveSubjectAction(id: string, archived = true): Promise<ActionResult<Subject>> {
  try {
    const session = await requireAuth();
    const [updated] = await db
      .update(subject)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(subject.id, id), eq(subject.userId, session.user.id)))
      .returning();
    if (!updated) return { success: false, error: "Subject not found" };
    revalidateStudyViews();
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not update the subject") };
  }
}

/** Moves through the book or course: +1 after finishing a lesson, -1 to undo. */
export async function advanceResourceAction(input: unknown): Promise<ActionResult<Subject>> {
  try {
    const session = await requireAuth();
    const parsed = advanceResourceSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Check the details" };
    const { subjectId, delta } = parsed.data;

    const [updated] = await db
      .update(subject)
      .set({
        resourceDone: sql`greatest(0, least(coalesce(${subject.resourceTotal}, 10000), ${subject.resourceDone} + ${delta}))`,
        updatedAt: new Date(),
      })
      .where(and(eq(subject.id, subjectId), eq(subject.userId, session.user.id)))
      .returning();
    if (!updated) return { success: false, error: "Subject not found" };
    revalidateStudyViews();
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not update your progress") };
  }
}

// ---------------------------------------------------------------- milestones

export async function listMilestonesQuery(): Promise<Milestone[]> {
  const session = await requireAuth();
  return db.query.milestone.findMany({
    where: eq(milestone.userId, session.user.id),
    orderBy: [asc(milestone.sortOrder), asc(milestone.createdAt)],
  });
}

/** Finished and total tasks per milestone id (cancelled tasks left out). */
export async function getMilestoneProgressQuery(): Promise<Record<string, { done: number; total: number }>> {
  const session = await requireAuth();
  const rows = await db.query.task.findMany({
    where: and(eq(task.userId, session.user.id), isNotNull(task.milestoneId)),
    columns: { milestoneId: true, status: true },
  });
  const ids = [...new Set(rows.map((r) => r.milestoneId!))];
  return Object.fromEntries(ids.map((id) => [id, milestoneProgress(id, rows)]));
}

export async function createMilestoneAction(input: unknown): Promise<ActionResult<Milestone>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = createMilestoneSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the milestone" };

    const project = await db.query.subject.findFirst({
      where: and(eq(subject.id, parsed.data.subjectId), eq(subject.userId, userId)),
      columns: { id: true, kind: true },
    });
    if (!project) return { success: false, error: "Project not found" };
    if (project.kind !== "PROJECT") return { success: false, error: "Milestones are for side projects" };

    const [last] = await db
      .select({ max: sql<number | null>`max(${milestone.sortOrder})` })
      .from(milestone)
      .where(and(eq(milestone.subjectId, project.id), eq(milestone.userId, userId)));

    const [created] = await db
      .insert(milestone)
      .values({
        userId,
        subjectId: project.id,
        name: parsed.data.name,
        targetDate: parsed.data.targetDate ?? null,
        sortOrder: (last?.max ?? -1) + 1,
      })
      .returning();
    revalidateStudyViews();
    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not add the milestone") };
  }
}

/** Rename, change the date, mark done or undone, or move up or down. */
export async function updateMilestoneAction(input: unknown): Promise<ActionResult<Milestone>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = updateMilestoneSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the milestone" };
    const { id, name, targetDate, done, move } = parsed.data;
    const owned = await ownMilestone(userId, id);

    if (move) {
      const siblings = await db.query.milestone.findMany({
        where: and(eq(milestone.subjectId, owned.subjectId), eq(milestone.userId, userId)),
        orderBy: [asc(milestone.sortOrder), asc(milestone.createdAt)],
        columns: { id: true },
      });
      const order = siblings.map((m) => m.id);
      const from = order.indexOf(id);
      const to = move === "up" ? from - 1 : from + 1;
      if (from >= 0 && to >= 0 && to < order.length) {
        [order[from], order[to]] = [order[to], order[from]];
        await db.transaction(async (tx) => {
          for (const [index, milestoneId] of order.entries()) {
            await tx
              .update(milestone)
              .set({ sortOrder: index })
              .where(and(eq(milestone.id, milestoneId), eq(milestone.userId, userId)));
          }
        });
      }
    }

    const changes: Partial<typeof milestone.$inferInsert> = { updatedAt: new Date() };
    if (name !== undefined) changes.name = name;
    if (targetDate !== undefined) changes.targetDate = targetDate;
    if (done !== undefined) changes.completedAt = done ? new Date() : null;

    const [updated] = await db
      .update(milestone)
      .set(changes)
      .where(and(eq(milestone.id, id), eq(milestone.userId, userId)))
      .returning();
    if (!updated) return { success: false, error: "Milestone not found" };
    revalidateStudyViews();
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not update the milestone") };
  }
}

/** Deletes a milestone; its tasks stay, without a milestone. */
export async function deleteMilestoneAction(id: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAuth();
    if (typeof id !== "string" || id.length === 0) return { success: false, error: "Milestone not found" };
    const deleted = await db
      .delete(milestone)
      .where(and(eq(milestone.id, id), eq(milestone.userId, session.user.id)))
      .returning({ id: milestone.id });
    if (deleted.length === 0) return { success: false, error: "Milestone not found" };
    revalidateStudyViews();
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not delete the milestone") };
  }
}

// ---------------------------------------------------------------- timer

export async function startStudyTimerAction(input: unknown): Promise<ActionResult<StudySession>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = startTimerSchema.safeParse(input ?? {});
    if (!parsed.success) return { success: false, error: "Invalid timer request" };

    const ownedTask = await ownTask(userId, parsed.data.taskId);
    const subjectId = (await ownSubjectId(userId, parsed.data.subjectId)) ?? ownedTask?.subjectId ?? null;
    let topicId: string | null = null;
    if (parsed.data.topicId) {
      const owned = await ownTopic(userId, parsed.data.topicId);
      if (owned.subjectId !== subjectId) throw new UserFacingError("That topic belongs to another subject");
      topicId = owned.id;
    }

    const [created] = await db
      .insert(studySession)
      .values({
        userId,
        subjectId,
        taskId: ownedTask?.id ?? null,
        topicId,
        startedAt: new Date(),
        endedAt: null,
        minutes: 0,
        plannedMinutes: parsed.data.plannedMinutes ?? defaultGoalMinutes(ownedTask?.estimatedMinutes),
        source: "TIMER",
      })
      .returning();
    revalidateStudyViews();
    return { success: true, data: created };
  } catch (err) {
    if (isUniqueViolation(err)) return { success: false, error: "A timer is already running. Stop it first." };
    return { success: false, error: safeErrorMessage(err, "Could not start the timer") };
  }
}

/** Changes the goal of the running timer (from the focus screen). */
export async function setStudyGoalAction(input: unknown): Promise<ActionResult<{ plannedMinutes: number }>> {
  try {
    const session = await requireAuth();
    const parsed = setGoalSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid goal" };

    const [updated] = await db
      .update(studySession)
      .set({ plannedMinutes: parsed.data.minutes })
      .where(and(eq(studySession.userId, session.user.id), isNull(studySession.endedAt)))
      .returning({ plannedMinutes: studySession.plannedMinutes });
    if (!updated) return { success: false, error: "No timer is running" };
    revalidateStudyViews();
    return { success: true, data: { plannedMinutes: updated.plannedMinutes ?? parsed.data.minutes } };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not change the goal") };
  }
}

export interface FocusData {
  sessionId: string;
  startedAt: Date;
  plannedMinutes: number;
  subjectId: string | null;
  subjectName: string | null;
  subjectKind: Subject["kind"] | null;
  taskId: string | null;
  taskTitle: string | null;
  /** Self-learning: the next unit of the book or course ("Lesson 19"), if tracked. */
  resourceNext: string | null;
  topicId: string | null;
  /** Active topics of the subject, most recently used first. */
  topics: { id: string; name: string }[];
}

/** The running timer with the names the focus screen shows, or null. */
export async function getFocusQuery(): Promise<FocusData | null> {
  const session = await requireAuth();
  const userId = session.user.id;
  const running = await db.query.studySession.findFirst({
    where: and(eq(studySession.userId, userId), isNull(studySession.endedAt)),
  });
  if (!running) return null;

  const [subjectRow, taskRow, subjectTopics] = await Promise.all([
    running.subjectId
      ? db.query.subject.findFirst({
          where: and(eq(subject.id, running.subjectId), eq(subject.userId, userId)),
          columns: { name: true, kind: true, resourceName: true, resourceUnit: true, resourceTotal: true, resourceDone: true },
        })
      : null,
    running.taskId
      ? db.query.task.findFirst({
          where: and(eq(task.id, running.taskId), eq(task.userId, userId)),
          columns: { title: true },
        })
      : null,
    running.subjectId
      ? db.query.topic.findMany({
          where: and(eq(topic.subjectId, running.subjectId), eq(topic.userId, userId), isNull(topic.archivedAt)),
          orderBy: [desc(topic.updatedAt)],
          columns: { id: true, name: true },
          limit: 12,
        })
      : [],
  ]);

  return {
    sessionId: running.id,
    startedAt: running.startedAt,
    plannedMinutes: running.plannedMinutes ?? defaultGoalMinutes(null),
    subjectId: running.subjectId,
    subjectName: subjectRow?.name ?? null,
    subjectKind: subjectRow?.kind ?? null,
    taskId: taskRow ? running.taskId : null,
    taskTitle: taskRow?.title ?? null,
    resourceNext:
      subjectRow?.kind === "SELF_LEARNING" ? (resourceProgress(subjectRow)?.nextShort ?? null) : null,
    topicId: running.topicId,
    topics: subjectTopics,
  };
}

export interface StopTimerResult {
  session: StudySession | null;
  /** True when the session was shorter than a minute and was not kept. */
  discarded: boolean;
  /** True when the timer ran longer than the cap and was cut to it. */
  capped: boolean;
}

export async function stopStudyTimerAction(): Promise<ActionResult<StopTimerResult>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const running = await db.query.studySession.findFirst({
      where: and(eq(studySession.userId, userId), isNull(studySession.endedAt)),
    });
    if (!running) return { success: false, error: "No timer is running" };

    const now = new Date();
    const elapsed = Math.round((now.getTime() - running.startedAt.getTime()) / 60_000);

    if (elapsed < 1) {
      await db.delete(studySession).where(and(eq(studySession.id, running.id), eq(studySession.userId, userId)));
      revalidateStudyViews();
      return { success: true, data: { session: null, discarded: true, capped: false } };
    }

    const capped = elapsed > MAX_TIMER_MINUTES;
    const minutes = Math.min(elapsed, MAX_TIMER_MINUTES);
    const [stopped] = await db
      .update(studySession)
      .set({
        minutes,
        endedAt: capped ? new Date(running.startedAt.getTime() + minutes * 60_000) : now,
      })
      .where(and(eq(studySession.id, running.id), eq(studySession.userId, userId)))
      .returning();
    revalidateStudyViews();
    return { success: true, data: { session: stopped, discarded: false, capped } };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not stop the timer") };
  }
}

export async function discardStudyTimerAction(): Promise<ActionResult<null>> {
  try {
    const session = await requireAuth();
    await db
      .delete(studySession)
      .where(and(eq(studySession.userId, session.user.id), isNull(studySession.endedAt)));
    revalidateStudyViews();
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not discard the timer") };
  }
}

// ---------------------------------------------------------------- manual log, rating, delete

export async function logStudySessionAction(input: unknown): Promise<ActionResult<StudySession>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = logStudySessionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
    const { minutes, date, rating, note } = parsed.data;

    const subjectId = await ownSubjectId(userId, parsed.data.subjectId);
    const topicId = parsed.data.topic ? await resolveTopicChoice(userId, subjectId, parsed.data.topic) : null;
    const timezone = await userTimezone(userId);
    const now = new Date();
    const today = toLocalDateKey(now, timezone);

    if (date > today) return { success: false, error: "That date is in the future" };
    if (date < addDaysToDateKey(today, -MANUAL_LOG_MAX_DAYS_BACK)) {
      return { success: false, error: `Only the last ${MANUAL_LOG_MAX_DAYS_BACK} days can be logged` };
    }

    // Today: the session is assumed to have just ended. Earlier days: anchored at noon local time.
    const endedAt = date === today ? now : new Date(localDateTimeToUtc(date, "12:00", timezone).getTime() + minutes * 60_000);
    const startedAt = new Date(endedAt.getTime() - minutes * 60_000);

    const [created] = await db
      .insert(studySession)
      .values({
        userId,
        subjectId,
        startedAt,
        endedAt,
        minutes,
        source: "MANUAL",
        rating: rating ?? null,
        note: note || null,
        topicId,
      })
      .returning();
    revalidateStudyViews();
    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not log the session") };
  }
}

export async function rateStudySessionAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const session = await requireAuth();
    const parsed = rateSessionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid rating" };

    const [updated] = await db
      .update(studySession)
      .set({ rating: parsed.data.rating })
      .where(and(eq(studySession.id, parsed.data.id), eq(studySession.userId, session.user.id)))
      .returning({ id: studySession.id });
    if (!updated) return { success: false, error: "Session not found" };
    revalidateStudyViews();
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not save the rating") };
  }
}

export async function deleteStudySessionAction(id: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAuth();
    const [deleted] = await db
      .delete(studySession)
      .where(and(eq(studySession.id, id), eq(studySession.userId, session.user.id), isNotNull(studySession.endedAt)))
      .returning({ id: studySession.id });
    if (!deleted) return { success: false, error: "Session not found" };
    revalidateStudyViews();
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not delete the session") };
  }
}

// ---------------------------------------------------------------- topics

/**
 * Turns a topic choice into a topic id for the given subject: an existing
 * topic (must be the user's and in that subject), a new name (created, or the
 * existing topic with that name reused and unarchived), or null.
 */
async function resolveTopicChoice(
  userId: string,
  subjectId: string | null,
  choice: z.infer<typeof topicChoiceSchema>
): Promise<string | null> {
  if ("newName" in choice) {
    if (!subjectId) throw new UserFacingError("Pick a subject first");
    const existing = await db.query.topic.findFirst({
      where: and(eq(topic.subjectId, subjectId), sql`lower(${topic.name}) = lower(${choice.newName})`),
      columns: { id: true, userId: true },
    });
    if (existing) {
      if (existing.userId !== userId) throw new UserFacingError("Topic not found");
      await db.update(topic).set({ archivedAt: null, updatedAt: new Date() }).where(eq(topic.id, existing.id));
      return existing.id;
    }
    const [created] = await db
      .insert(topic)
      .values({ userId, subjectId, name: choice.newName })
      .returning({ id: topic.id });
    return created.id;
  }

  if (choice.topicId === null) return null;
  const owned = await ownTopic(userId, choice.topicId);
  if (owned.subjectId !== subjectId) throw new UserFacingError("That topic belongs to another subject");
  // Recently used topics are offered first.
  await db.update(topic).set({ updatedAt: new Date() }).where(eq(topic.id, owned.id));
  return owned.id;
}

export async function listTopicsQuery(): Promise<Topic[]> {
  const session = await requireAuth();
  return db.query.topic.findMany({
    where: eq(topic.userId, session.user.id),
    orderBy: [desc(topic.updatedAt)],
  });
}

/** Records what a finished session covered. */
export async function setSessionTopicAction(
  input: unknown
): Promise<ActionResult<{ topicId: string | null; topicName: string | null }>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = setSessionTopicSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the topic" };

    const studied = await db.query.studySession.findFirst({
      where: and(eq(studySession.id, parsed.data.sessionId), eq(studySession.userId, userId)),
      columns: { id: true, subjectId: true },
    });
    if (!studied) return { success: false, error: "Session not found" };

    const topicId = await resolveTopicChoice(userId, studied.subjectId, parsed.data.choice);
    await db
      .update(studySession)
      .set({ topicId })
      .where(and(eq(studySession.id, studied.id), eq(studySession.userId, userId)));

    const named = topicId ? await db.query.topic.findFirst({ where: eq(topic.id, topicId), columns: { name: true } }) : null;
    revalidateStudyViews();
    return { success: true, data: { topicId, topicName: named?.name ?? null } };
  } catch (err) {
    if (isUniqueViolation(err)) return { success: false, error: "That topic already exists" };
    return { success: false, error: safeErrorMessage(err, "Could not save the topic") };
  }
}

export async function renameTopicAction(input: unknown): Promise<ActionResult<Topic>> {
  try {
    const session = await requireAuth();
    const parsed = renameTopicSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
    const [updated] = await db
      .update(topic)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(and(eq(topic.id, parsed.data.id), eq(topic.userId, session.user.id)))
      .returning();
    if (!updated) return { success: false, error: "Topic not found" };
    revalidateStudyViews();
    return { success: true, data: updated };
  } catch (err) {
    if (isUniqueViolation(err)) return { success: false, error: "That subject already has a topic with that name" };
    return { success: false, error: safeErrorMessage(err, "Could not rename the topic") };
  }
}

export async function archiveTopicAction(id: string, archived = true): Promise<ActionResult<Topic>> {
  try {
    const session = await requireAuth();
    const [updated] = await db
      .update(topic)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(topic.id, id), eq(topic.userId, session.user.id)))
      .returning();
    if (!updated) return { success: false, error: "Topic not found" };
    revalidateStudyViews();
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not update the topic") };
  }
}

// ---------------------------------------------------------------- add to my plan

export interface PlannedStudyBlock {
  title: string;
  plannedAt: Date | null;
  notPlannedReason: string | null;
  /** True when an open task with the same title already existed and was reused. */
  reused: boolean;
}

/**
 * "Add to my plan": turns a study suggestion into a task (e.g. "Review:
 * Calculus · Limits") due by the end of its review day, then plans the week so
 * it lands in free time. Reuses an open task with the same title instead of
 * creating duplicates.
 */
export async function planStudyBlockAction(input: unknown): Promise<ActionResult<PlannedStudyBlock>> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = planStudyBlockSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
    const { minutes, reviewOn } = parsed.data;

    const subjectId = (await ownSubjectId(userId, parsed.data.subjectId))!;

    // The suggestion is an existing task (a project's next task, a class
    // assignment): plan that task instead of adding a study block.
    if (parsed.data.taskId) {
      const owned = (await ownTask(userId, parsed.data.taskId))!;
      if (owned.subjectId !== subjectId) throw new UserFacingError("That task belongs to another subject");
      const taskRow = (await db.query.task.findFirst({
        where: and(eq(task.id, owned.id), eq(task.userId, userId)),
        columns: { title: true, status: true },
      }))!;
      if (taskRow.status === "COMPLETED" || taskRow.status === "CANCELLED") {
        return { success: false, error: "That task is already closed" };
      }
      const replanned = await replanWeekAction();
      const plannedAt = replanned.success
        ? (replanned.data.scheduled.find((s) => s.taskId === owned.id)?.startTime ?? null)
        : null;
      return {
        success: true,
        data: {
          title: taskRow.title,
          plannedAt,
          notPlannedReason: plannedAt
            ? null
            : replanned.success
              ? (replanned.data.unscheduled.find((u) => u.task.id === owned.id)?.reason ??
                "Already planned or outside this week")
              : replanned.error,
          reused: true,
        },
      };
    }

    const subjectRow = await db.query.subject.findFirst({
      where: eq(subject.id, subjectId),
      columns: { name: true, kind: true, resourceName: true, resourceUnit: true, resourceTotal: true, resourceDone: true },
    });
    let topicName: string | null = null;
    if (parsed.data.topicId) {
      const owned = await ownTopic(userId, parsed.data.topicId);
      if (owned.subjectId !== subjectId) throw new UserFacingError("That topic belongs to another subject");
      topicName = (await db.query.topic.findFirst({ where: eq(topic.id, owned.id), columns: { name: true } }))?.name ?? null;
    }
    const nextUnit = subjectRow!.kind === "SELF_LEARNING" ? resourceProgress(subjectRow!)?.nextShort : null;
    const title = topicName
      ? `Review: ${subjectRow!.name} · ${topicName}`
      : nextUnit
        ? `Study: ${subjectRow!.name} · ${nextUnit}`
        : `Study: ${subjectRow!.name}`;

    const timezone = await userTimezone(userId);
    const today = toLocalDateKey(new Date(), timezone);
    const dueDay = reviewOn && reviewOn >= today ? reviewOn : addDaysToDateKey(today, 1);
    const deadline = localDateTimeToUtc(dueDay, "23:59", timezone);

    const existing = await db.query.task.findFirst({
      where: and(
        eq(task.userId, userId),
        eq(task.title, title),
        or(eq(task.status, "TODO"), eq(task.status, "IN_PROGRESS"))
      ),
      columns: { id: true },
    });

    if (existing) {
      const replanned = await replanWeekAction();
      const plannedAt = replanned.success
        ? (replanned.data.scheduled.find((s) => s.taskId === existing.id)?.startTime ?? null)
        : null;
      return {
        success: true,
        data: {
          title,
          plannedAt,
          notPlannedReason: plannedAt ? null : replanned.success ? "No free slot before it is due" : replanned.error,
          reused: true,
        },
      };
    }

    const added = await quickAddTaskAction({
      title,
      priority: "MEDIUM",
      status: "TODO",
      estimatedMinutes: minutes,
      deadline: deadline.toISOString(),
      subjectId,
    });
    if (!added.success) return { success: false, error: added.error };
    revalidateStudyViews();
    return {
      success: true,
      data: { title, plannedAt: added.data.plannedAt, notPlannedReason: added.data.notPlannedReason, reused: false },
    };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not add it to your plan") };
  }
}

// ---------------------------------------------------------------- shared context

export interface StudyContext {
  timezone: string;
  subjects: Subject[];
  /** Finished sessions from the last 30 days, newest first. */
  sessions: StudySession[];
  running: StudySession | null;
  /** Open tasks (to do or in progress), for suggestions. */
  openTasks: Task[];
  /** Titles of tasks referenced by the sessions, including finished ones. */
  taskTitles: Record<string, string>;
  /** All topics, most recently used first. */
  topics: Topic[];
  /** Finished tasks with an estimate and the minutes logged on them. */
  finishedTaskEstimates: { estimatedMinutes: number; actualMinutes: number }[];
  /** Milestones of all projects, in order. */
  milestones: Milestone[];
  /** Status of every task that belongs to a milestone, for progress counts. */
  milestoneTasks: { milestoneId: string | null; status: Task["status"] }[];
}

/** Everything the Today "Next up" line and the Progress screen need. */
export async function getStudyContextQuery(): Promise<StudyContext> {
  const session = await requireAuth();
  const userId = session.user.id;
  // A year of history: the memory model replays it to know what is due.
  const since = new Date(Date.now() - 365 * 86_400_000);

  const [timezone, subjects, sessions, running, openTasks, topics, milestones, milestoneTasks] = await Promise.all([
    userTimezone(userId),
    db.query.subject.findMany({ where: eq(subject.userId, userId), orderBy: [asc(subject.name)] }),
    db.query.studySession.findMany({
      where: and(eq(studySession.userId, userId), isNotNull(studySession.endedAt), gte(studySession.startedAt, since)),
      orderBy: [desc(studySession.startedAt)],
    }),
    db.query.studySession.findFirst({
      where: and(eq(studySession.userId, userId), isNull(studySession.endedAt)),
    }),
    db.query.task.findMany({
      where: and(eq(task.userId, userId), or(eq(task.status, "TODO"), eq(task.status, "IN_PROGRESS"))),
      orderBy: [asc(task.deadline)],
    }),
    db.query.topic.findMany({ where: eq(topic.userId, userId), orderBy: [desc(topic.updatedAt)] }),
    db.query.milestone.findMany({
      where: eq(milestone.userId, userId),
      orderBy: [asc(milestone.sortOrder), asc(milestone.createdAt)],
    }),
    db.query.task.findMany({
      where: and(eq(task.userId, userId), isNotNull(task.milestoneId)),
      columns: { milestoneId: true, status: true },
    }),
  ]);

  const sessionTaskIds = [...new Set(sessions.map((s) => s.taskId).filter((id): id is string => id !== null))];
  const sessionTasks =
    sessionTaskIds.length > 0
      ? await db.query.task.findMany({
          where: and(eq(task.userId, userId), inArray(task.id, sessionTaskIds)),
          columns: { id: true, title: true, estimatedMinutes: true, status: true },
        })
      : [];
  const taskTitles = Object.fromEntries(sessionTasks.map((t) => [t.id, t.title]));

  // Finished tasks with an estimate, next to the minutes actually studied on them.
  const minutesByTask = new Map<string, number>();
  for (const s of sessions) {
    if (s.taskId) minutesByTask.set(s.taskId, (minutesByTask.get(s.taskId) ?? 0) + s.minutes);
  }
  const finishedTaskEstimates = sessionTasks
    .filter((t) => t.status === "COMPLETED" && t.estimatedMinutes)
    .map((t) => ({ estimatedMinutes: t.estimatedMinutes!, actualMinutes: minutesByTask.get(t.id) ?? 0 }));

  return {
    timezone,
    subjects,
    sessions,
    running: running ?? null,
    openTasks,
    taskTitles,
    topics,
    finishedTaskEstimates,
    milestones,
    milestoneTasks,
  };
}

// ---------------------------------------------------------------- AI suggestion

export interface AiStudyNextResult {
  source: "ai" | "ranking";
  suggestion: StudyNextSuggestion | null;
  /** One concrete thing to do, from the AI coach; null for the ranking fallback. */
  step: string | null;
}

/**
 * Asks the AI coach what to study next and what exactly to do. The model sees
 * aggregated stats, the memory model's review schedule, topics, exams, goals
 * and learned habits, never session notes. Its answer is validated against the
 * user's own data, and any failure falls back to the deterministic ranking.
 */
export async function askAiStudyNextAction(): Promise<ActionResult<AiStudyNextResult>> {
  try {
    const context = await getStudyContextQuery();
    const now = new Date();
    const { timezone } = context;
    const today = toLocalDateKey(now, timezone);
    const active = context.subjects.filter((s) => !s.archivedAt);
    const activeTopics = context.topics.filter((t) => !t.archivedAt);
    const ranking = rankStudyNext({
      subjects: active,
      topics: activeTopics,
      milestones: context.milestones,
      openTasks: context.openTasks,
      sessions: context.sessions,
      now,
      timezone,
    });
    const fallback: AiStudyNextResult = { source: "ranking", suggestion: ranking[0] ?? null, step: null };
    if (active.length === 0) return { success: true, data: fallback };

    const { bySubject } = summarizeStudy(context.sessions, now);
    const daysSince = (date: Date | null | undefined) =>
      date ? Math.floor((now.getTime() - date.getTime()) / 86_400_000) : null;

    const aiContext: StudyNextAiContext = {
      currentDate: today,
      timezone,
      habits: {
        usualStudyHours: usualHours(context.sessions, timezone),
        estimateRatio: estimateRatio(context.finishedTaskEstimates),
      },
      subjects: active.map((s) => {
        const stat = bySubject.get(s.id);
        const subjectSessions = context.sessions.filter((x) => x.subjectId === s.id);
        const isProject = s.kind === "PROJECT";
        const examDate = s.kind === "CLASS" ? s.examDate : null;
        const memory = isProject ? null : replayMemory(subjectSessions, { timezone, examDate });
        const resource = s.kind === "SELF_LEARNING" ? resourceProgress(s) : null;
        const current = isProject ? currentMilestone(s.id, context.milestones) : null;
        return {
          id: s.id,
          name: s.name,
          kind: s.kind,
          confidence: isProject ? null : s.confidence,
          examDate,
          targetDate: s.kind === "SELF_LEARNING" ? s.examDate : null,
          practice:
            s.kind === "SELF_LEARNING" && s.practiceDaysPerWeek
              ? describeStreak(practiceStreak(subjectSessions, { now, timezone, daysPerWeek: s.practiceDaysPerWeek }))
              : null,
          resource: resource ? { name: resource.name, progress: resource.doneLabel, next: resource.nextLabel } : null,
          milestones: isProject
            ? context.milestones
                .filter((m) => m.subjectId === s.id)
                .slice(0, 10)
                .map((m) => {
                  const progress = milestoneProgress(m.id, context.milestoneTasks);
                  return {
                    name: m.name,
                    targetDate: m.targetDate,
                    done: m.completedAt !== null,
                    current: current?.id === m.id,
                    tasksDone: progress.done,
                    tasksTotal: progress.total,
                  };
                })
            : undefined,
          weeklyGoalMinutes: s.weeklyGoalMinutes,
          minutesLast7Days: stat?.minutes7d ?? 0,
          daysSinceLastStudied: daysSince(stat?.lastStudiedAt),
          latestRating: stat?.latestRating ?? null,
          typicalMinutes: typicalMinutes(subjectSessions),
          nextReviewOn: memory?.nextReviewOn ?? null,
          topics: activeTopics
            .filter((t) => t.subjectId === s.id && !isProject)
            .slice(0, 15)
            .map((t) => {
              const topicSessions = subjectSessions.filter((x) => x.topicId === t.id);
              const topicMemory = replayMemory(topicSessions, { timezone, examDate });
              const last = topicSessions.reduce<Date | null>(
                (latest, x) => (!latest || x.startedAt > latest ? x.startedAt : latest),
                null
              );
              return {
                id: t.id,
                name: t.name,
                daysSinceStudied: daysSince(last),
                lastRating: topicMemory?.lastRating ?? null,
                nextReviewOn: topicMemory?.nextReviewOn ?? null,
                dueForReview: topicMemory ? reviewStatus(topicMemory, today).due : false,
              };
            }),
          openTasks: context.openTasks
            .filter((t) => t.subjectId === s.id)
            .slice(0, 10)
            .map((t) => ({
              id: t.id,
              title: t.title,
              deadline: t.deadline?.toISOString() ?? null,
              estimatedMinutes: t.estimatedMinutes,
              milestone: t.milestoneId ? (context.milestones.find((m) => m.id === t.milestoneId)?.name ?? null) : null,
            })),
        };
      }),
    };

    const ai = await suggestStudyNextWithAi(aiContext);
    if (!ai) return { success: true, data: fallback };

    // Validated against aiContext already; look the rows up for display.
    const subjectRow = active.find((s) => s.id === ai.subjectId)!;
    const topicRow = ai.topicId ? activeTopics.find((t) => t.id === ai.topicId) ?? null : null;
    const taskRow = ai.taskId ? context.openTasks.find((t) => t.id === ai.taskId) ?? null : null;
    const ranked = ranking.find((r) => r.subjectId === subjectRow.id);
    const topicReview = topicRow
      ? aiContext.subjects.find((x) => x.id === subjectRow.id)?.topics?.find((t) => t.id === topicRow.id)?.nextReviewOn ?? null
      : null;

    return {
      success: true,
      data: {
        source: "ai",
        step: ai.step,
        suggestion: {
          subjectId: subjectRow.id,
          subjectName: subjectRow.name,
          kind: subjectRow.kind,
          topicId: topicRow?.id ?? null,
          topicName: topicRow?.name ?? null,
          taskId: taskRow?.id ?? null,
          taskTitle: taskRow?.title ?? null,
          milestoneName: taskRow?.milestoneId
            ? (context.milestones.find((m) => m.id === taskRow.milestoneId)?.name ?? null)
            : null,
          resourceNext: !topicRow && !taskRow ? (ranked?.resourceNext ?? null) : null,
          reviewOn: topicReview,
          minutes: ai.minutes,
          reason: ai.reason,
          score: 0,
        },
      },
    };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not get a suggestion") };
  }
}
