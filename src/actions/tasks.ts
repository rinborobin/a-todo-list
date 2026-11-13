"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { scheduleItem, task, type Task } from "@/db/schema";
import { requireAuth, assertUserOwnership } from "@/lib/session";
import { safeErrorMessage } from "@/lib/error";
import { ownSubjectId, ownTaskMilestoneId } from "@/lib/study/ownership";
import {
  createTaskSchema,
  updateTaskSchema,
  taskFilterSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/validations/task";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[] | undefined> };


/**
 * Creates a new task for the authenticated user.
 */
export async function createTaskAction(input: CreateTaskInput): Promise<ActionResult<Task>> {
  try {
    const session = await requireAuth();
    const result = createTaskSchema.safeParse(input);

    if (!result.success) {
      const flattened = result.error.flatten();
      return {
        success: false,
        error: "Validation failed. Please check the fields.",
        fieldErrors: flattened.fieldErrors,
      };
    }

    const subjectId = await ownSubjectId(session.user.id, result.data.subjectId);
    const milestoneId = await ownTaskMilestoneId(session.user.id, result.data.milestoneId, subjectId);

    const [newTask] = await db
      .insert(task)
      .values({
        userId: session.user.id,
        subjectId,
        milestoneId,
        title: result.data.title,
        description: result.data.description ?? null,
        priority: result.data.priority,
        status: result.data.status,
        estimatedMinutes: result.data.estimatedMinutes ?? null,
        deadline: result.data.deadline ?? null,
      })
      .returning();

    revalidatePath("/tasks");
    revalidatePath("/today");

    return { success: true, data: newTask };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to create task"),
    };
  }
}

/**
 * Updates an existing task ensuring user ownership.
 */
export async function updateTaskAction(
  id: string,
  input: UpdateTaskInput
): Promise<ActionResult<Task>> {
  try {
    const session = await requireAuth();
    const result = updateTaskSchema.safeParse(input);

    if (!result.success) {
      const flattened = result.error.flatten();
      return {
        success: false,
        error: "Validation failed. Please check the fields.",
        fieldErrors: flattened.fieldErrors,
      };
    }

    const existingTask = await db.query.task.findFirst({
      where: and(eq(task.id, id), eq(task.userId, session.user.id)),
    });

    if (!existingTask) {
      return { success: false, error: "Task not found or access denied" };
    }

    assertUserOwnership(existingTask.userId, session.user.id);

    const { subjectId, milestoneId, ...fields } = result.data;
    // Only touch the subject when the caller sent one; verify ownership first.
    const nextSubjectId =
      subjectId !== undefined ? await ownSubjectId(session.user.id, subjectId) : existingTask.subjectId;
    // A milestone must belong to the task's own project; moving the task to
    // another subject drops a milestone that no longer fits.
    const nextMilestoneId =
      milestoneId !== undefined
        ? await ownTaskMilestoneId(session.user.id, milestoneId, nextSubjectId)
        : nextSubjectId !== existingTask.subjectId
          ? null
          : existingTask.milestoneId;

    const [updatedTask] = await db
      .update(task)
      .set({
        ...fields,
        subjectId: nextSubjectId,
        milestoneId: nextMilestoneId,
        updatedAt: new Date(),
      })
      .where(and(eq(task.id, id), eq(task.userId, session.user.id)))
      .returning();

    revalidatePath("/tasks");
    revalidatePath("/today");

    return { success: true, data: updatedTask };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to update task"),
    };
  }
}

/**
 * Deletes a task ensuring user ownership.
 */
export async function deleteTaskAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAuth();

    const existingTask = await db.query.task.findFirst({
      where: and(eq(task.id, id), eq(task.userId, session.user.id)),
    });

    if (!existingTask) {
      return { success: false, error: "Task not found or access denied" };
    }

    assertUserOwnership(existingTask.userId, session.user.id);

    await db.transaction(async (tx) => {
      // Upcoming blocks for a deleted task are meaningless; completed and
      // skipped blocks stay as history (their task_id is set to null).
      await tx
        .delete(scheduleItem)
        .where(and(eq(scheduleItem.taskId, id), eq(scheduleItem.status, "SCHEDULED")));
      await tx.delete(task).where(and(eq(task.id, id), eq(task.userId, session.user.id)));
    });

    revalidatePath("/tasks");
    revalidatePath("/today");
    revalidatePath("/week");

    return { success: true, data: { id } };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to delete task"),
    };
  }
}

/**
 * Fast toggle of task status.
 */
export async function toggleTaskStatusAction(
  id: string,
  newStatus: TaskStatus
): Promise<ActionResult<Task>> {
  try {
    const session = await requireAuth();

    const statusResult = updateTaskSchema.shape.status.safeParse(newStatus);
    if (!statusResult.success) {
      return { success: false, error: "Invalid task status" };
    }

    const existingTask = await db.query.task.findFirst({
      where: and(eq(task.id, id), eq(task.userId, session.user.id)),
    });

    if (!existingTask) {
      return { success: false, error: "Task not found or access denied" };
    }

    assertUserOwnership(existingTask.userId, session.user.id);

    const [updatedTask] = await db
      .update(task)
      .set({
        status: statusResult.data,
        updatedAt: new Date(),
      })
      .where(and(eq(task.id, id), eq(task.userId, session.user.id)))
      .returning();

    revalidatePath("/tasks");
    revalidatePath("/today");

    return { success: true, data: updatedTask };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to update task status"),
    };
  }
}

/**
 * Fetches a single task by ID if it belongs to the current user.
 */
export async function getTaskByIdAction(id: string): Promise<ActionResult<Task>> {
  try {
    const session = await requireAuth();

    const existingTask = await db.query.task.findFirst({
      where: and(eq(task.id, id), eq(task.userId, session.user.id)),
    });

    if (!existingTask) {
      return { success: false, error: "Task not found or access denied" };
    }

    return { success: true, data: existingTask };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to load task"),
    };
  }
}

/**
 * Server query for fetching tasks belonging to the current user with optional filtering and sorting.
 */
export async function getUserTasksQuery(options?: {
  status?: string;
  priority?: string;
  search?: string;
  sortBy?: "deadline" | "priority" | "createdAt";
  sortOrder?: "asc" | "desc";
}): Promise<Task[]> {
  const session = await requireAuth();
  const filters = taskFilterSchema.safeParse(options ?? {});

  const {
    status: filterStatus,
    priority: filterPriority,
    search: filterSearch,
    sortBy,
    sortOrder,
  } = filters.success ? filters.data : taskFilterSchema.parse({});

  const conditions = [eq(task.userId, session.user.id)];

  if (filterStatus && filterStatus !== "ALL") {
    conditions.push(eq(task.status, filterStatus as TaskStatus));
  }

  if (filterPriority && filterPriority !== "ALL") {
    conditions.push(eq(task.priority, filterPriority as TaskPriority));
  }

  if (filterSearch && filterSearch.trim()) {
    const pattern = `%${filterSearch.trim()}%`;
    conditions.push(or(ilike(task.title, pattern), ilike(task.description, pattern))!);
  }

  let order = desc(task.createdAt);
  const isAsc = sortOrder === "asc";

  if (sortBy === "deadline") {
    order = isAsc ? asc(task.deadline) : desc(task.deadline);
  } else if (sortBy === "createdAt") {
    order = isAsc ? asc(task.createdAt) : desc(task.createdAt);
  }

  return await db.query.task.findMany({
    where: and(...conditions),
    orderBy: [order],
  });
}
