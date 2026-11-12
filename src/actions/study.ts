"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  studySession,
  subject,
  task,
  topic,
  user,
  type StudySession,
  type Subject,
  type Task,
  type Topic,
} from "@/db/schema";
import { requireAuth } from "@/lib/session";
import { UserFacingError, safeErrorMessage } from "@/lib/error";
import { ownSubjectId, ownTask, ownTopic } from "@/lib/study/ownership";
import { addDaysToDateKey, localDateTimeToUtc, toLocalDateKey } from "@/lib/scheduling/timezone";
import {
  createSubjectSchema,
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
import { suggestStudyNextWithAi } from "@/lib/ai/study-next";
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
      .values({ userId: session.user.id, name: parsed.data.name })
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
 * Saves what the student told us about a subject during setup: confidence,
 * exam date and weekly goal. Only the fields that are sent are changed.
 */
export async function updateSubjectSetupAction(input: unknown): Promise<ActionResult<Subject>> {
  try {
    const session = await requireAuth();
    const parsed = subjectSetupSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
    const { id, ...fields } = parsed.data;

    const changes: Partial<typeof subject.$inferInsert> = { updatedAt: new Date() };
    if (fields.confidence !== undefined) changes.confidence = fields.confidence;
    if (fields.examDate !== undefined) changes.examDate = fields.examDate;
    if (fields.weeklyGoalMinutes !== undefined) changes.weeklyGoalMinutes = fields.weeklyGoalMinutes;

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
  taskTitle: string | null;
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
          columns: { name: true },
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
    taskTitle: taskRow?.title ?? null,
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
    const subjectRow = await db.query.subject.findFirst({ where: eq(subject.id, subjectId), columns: { name: true } });
    let topicName: string | null = null;
    if (parsed.data.topicId) {
      const owned = await ownTopic(userId, parsed.data.topicId);
      if (owned.subjectId !== subjectId) throw new UserFacingError("That topic belongs to another subject");
      topicName = (await db.query.topic.findFirst({ where: eq(topic.id, owned.id), columns: { name: true } }))?.name ?? null;
    }
    const title = topicName ? `Review: ${subjectRow!.name} · ${topicName}` : `Study: ${subjectRow!.name}`;

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
}

/** Everything the Today "Study next" line and the Progress screen need. */
export async function getStudyContextQuery(): Promise<StudyContext> {
  const session = await requireAuth();
  const userId = session.user.id;
  // A year of history: the memory model replays it to know what is due.
  const since = new Date(Date.now() - 365 * 86_400_000);

  const [timezone, subjects, sessions, running, openTasks, topics] = await Promise.all([
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
  ]);

  const sessionTaskIds = [...new Set(sessions.map((s) => s.taskId).filter((id): id is string => id !== null))];
  const sessionTasks =
    sessionTaskIds.length > 0
      ? await db.query.task.findMany({
          where: and(eq(task.userId, userId), inArray(task.id, sessionTaskIds)),
          columns: { id: true, title: true },
        })
      : [];
  const taskTitles = Object.fromEntries(sessionTasks.map((t) => [t.id, t.title]));

  return { timezone, subjects, sessions, running: running ?? null, openTasks, taskTitles, topics };
}

// ---------------------------------------------------------------- AI suggestion

export interface AiStudyNextResult {
  source: "ai" | "ranking";
  suggestion: StudyNextSuggestion | null;
}

/**
 * Asks the AI what to study next. The model only sees aggregated stats and
 * open tasks; its answer is validated against the user's own data, and any
 * failure falls back to the deterministic ranking.
 */
export async function askAiStudyNextAction(): Promise<ActionResult<AiStudyNextResult>> {
  try {
    const context = await getStudyContextQuery();
    const now = new Date();
    const active = context.subjects.filter((s) => !s.archivedAt);
    const ranking = rankStudyNext({
      subjects: active,
      openTasks: context.openTasks,
      sessions: context.sessions,
      now,
      timezone: context.timezone,
    });
    const fallback: AiStudyNextResult = { source: "ranking", suggestion: ranking[0] ?? null };
    if (active.length === 0) return { success: true, data: fallback };

    const { bySubject } = summarizeStudy(context.sessions, now);
    const aiContext: StudyNextAiContext = {
      currentDate: toLocalDateKey(now, context.timezone),
      timezone: context.timezone,
      subjects: active.map((s) => {
        const stat = bySubject.get(s.id);
        return {
          id: s.id,
          name: s.name,
          minutesLast7Days: stat?.minutes7d ?? 0,
          daysSinceLastStudied: stat?.lastStudiedAt
            ? Math.floor((now.getTime() - stat.lastStudiedAt.getTime()) / 86_400_000)
            : null,
          latestRating: stat?.latestRating ?? null,
          openTasks: context.openTasks
            .filter((t) => t.subjectId === s.id)
            .slice(0, 10)
            .map((t) => ({
              id: t.id,
              title: t.title,
              deadline: t.deadline?.toISOString() ?? null,
              estimatedMinutes: t.estimatedMinutes,
            })),
        };
      }),
    };

    const ai = await suggestStudyNextWithAi(aiContext);
    if (!ai) return { success: true, data: fallback };

    const subjectRow = active.find((s) => s.id === ai.subjectId)!;
    const taskRow = ai.taskId ? context.openTasks.find((t) => t.id === ai.taskId) : null;
    return {
      success: true,
      data: {
        source: "ai",
        suggestion: {
          subjectId: subjectRow.id,
          subjectName: subjectRow.name,
          topicId: null,
          topicName: null,
          taskId: taskRow?.id ?? null,
          taskTitle: taskRow?.title ?? null,
          reviewOn: null,
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
