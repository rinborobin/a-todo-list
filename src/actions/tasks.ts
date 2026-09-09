"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { task, type Task } from "@/db/schema";
import { requireAuth, assertUserOwnership } from "@/lib/session";
import {
  createTaskSchema,
  updateTaskSchema,
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

    const [newTask] = await db
      .insert(task)
      .values({
        userId: session.user.id,
        title: result.data.title,
        description: result.data.description ?? null,
        priority: result.data.priority,
        status: result.data.status,
        estimatedMinutes: result.data.estimatedMinutes ?? null,
        deadline: result.data.deadline ?? null,
      })
      .returning();

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return { success: true, data: newTask };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create task",
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

    const [updatedTask] = await db
      .update(task)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(and(eq(task.id, id), eq(task.userId, session.user.id)))
      .returning();

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return { success: true, data: updatedTask };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update task",
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

    await db.delete(task).where(and(eq(task.id, id), eq(task.userId, session.user.id)));

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return { success: true, data: { id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete task",
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
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(task.id, id), eq(task.userId, session.user.id)))
      .returning();

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return { success: true, data: updatedTask };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update task status",
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
  const conditions = [eq(task.userId, session.user.id)];

  if (options?.status && options.status !== "ALL") {
    conditions.push(eq(task.status, options.status as TaskStatus));
  }

  if (options?.priority && options.priority !== "ALL") {
    conditions.push(eq(task.priority, options.priority as TaskPriority));
  }

  if (options?.search && options.search.trim()) {
    const pattern = `%${options.search.trim()}%`;
    conditions.push(or(ilike(task.title, pattern), ilike(task.description, pattern))!);
  }

  let order = desc(task.createdAt);
  const isAsc = options?.sortOrder === "asc";

  if (options?.sortBy === "deadline") {
    order = isAsc ? asc(task.deadline) : desc(task.deadline);
  } else if (options?.sortBy === "createdAt") {
    order = isAsc ? asc(task.createdAt) : desc(task.createdAt);
  }

  return await db.query.task.findMany({
    where: and(...conditions),
    orderBy: [order],
  });
}

/**
 * Server query for aggregated user task statistics.
 */
export async function getUserTaskStatsQuery(): Promise<{
  total: number;
  todo: number;
  inProgress: number;
  completed: number;
  urgent: number;
}> {
  const session = await requireAuth();
  const tasks = await db.query.task.findMany({
    where: eq(task.userId, session.user.id),
  });

  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "TODO").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    urgent: tasks.filter((t) => (t.priority === "URGENT" || t.priority === "HIGH") && t.status !== "COMPLETED" && t.status !== "CANCELLED").length,
  };
}