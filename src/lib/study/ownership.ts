import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subject, task } from "@/db/schema";
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
): Promise<{ id: string; subjectId: string | null } | null> {
  if (!taskId) return null;
  const found = await db.query.task.findFirst({
    where: and(eq(task.id, taskId), eq(task.userId, userId)),
    columns: { id: true, subjectId: true },
  });
  if (!found) throw new UserFacingError("Task not found");
  return found;
}
