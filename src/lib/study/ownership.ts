import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { milestone, subject, task, topic } from "@/db/schema";
import { UserFacingError } from "@/lib/error";

/**
 * Returns the subject id if it belongs to the user, null when none was given.
 * Throws when an id is given that the user does not own, so a crafted id can
 * never attach data to someone else's subject.
 */
export async function ownSubjectId(userId: string, subjectId: string | null | undefined): Promise<string | null> {
  if (!subjectId) return null;
  const found = await db.query.subject.findFirst({
    where: and(eq(subject.id, subjectId), eq(subject.userId, userId)),
    columns: { id: true },
  });
  if (!found) throw new UserFacingError("Subject not found");
  return found.id;
}

/** Same as ownSubjectId for tasks; also returns the task's subject. */
export async function ownTask(
  userId: string,
  taskId: string | null | undefined
): Promise<{ id: string; subjectId: string | null; estimatedMinutes: number | null } | null> {
  if (!taskId) return null;
  const found = await db.query.task.findFirst({
    where: and(eq(task.id, taskId), eq(task.userId, userId)),
    columns: { id: true, subjectId: true, estimatedMinutes: true },
  });
  if (!found) throw new UserFacingError("Task not found");
  return found;
}

/** A topic the user owns, with its subject; throws for anything else. */
export async function ownTopic(userId: string, topicId: string): Promise<{ id: string; subjectId: string }> {
  const found = await db.query.topic.findFirst({
    where: and(eq(topic.id, topicId), eq(topic.userId, userId)),
    columns: { id: true, subjectId: true },
  });
  if (!found) throw new UserFacingError("Topic not found");
  return found;
}

/** A milestone the user owns, with its project; throws for anything else. */
export async function ownMilestone(userId: string, milestoneId: string): Promise<{ id: string; subjectId: string }> {
  const found = await db.query.milestone.findFirst({
    where: and(eq(milestone.id, milestoneId), eq(milestone.userId, userId)),
    columns: { id: true, subjectId: true },
  });
  if (!found) throw new UserFacingError("Milestone not found");
  return found;
}

/**
 * The milestone id to store on a task: null when none is given, otherwise a
 * milestone the user owns that belongs to the task's own project.
 */
export async function ownTaskMilestoneId(
  userId: string,
  milestoneId: string | null | undefined,
  subjectId: string | null
): Promise<string | null> {
  if (!milestoneId) return null;
  const found = await ownMilestone(userId, milestoneId);
  if (found.subjectId !== subjectId) throw new UserFacingError("That milestone belongs to another project");
  return found.id;
}
