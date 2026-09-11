"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { availability, user, type Availability, type DayOfWeek } from "@/db/schema";
import { requireAuth, assertUserOwnership } from "@/lib/session";
import {
  createAvailabilitySchema,
  updateAvailabilitySchema,
  updateTimezoneSchema,
  type CreateAvailabilityInput,
  type UpdateAvailabilityInput,
  type UpdateTimezoneInput,
} from "@/lib/validations/availability";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function safeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("connection") || message.includes("timeout") || message.includes("database")) {
      return fallback;
    }
    return err.message;
  }
  return fallback;
}

function normalizeTime(value: string): string {
  // PostgreSQL time may be returned as "HH:mm:ss"; normalize to "HH:mm" for display/comparison.
  return value.slice(0, 5);
}

function overlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
  allowTouching = true
): boolean {
  const aStart = normalizeTime(startA);
  const aEnd = normalizeTime(endA);
  const bStart = normalizeTime(startB);
  const bEnd = normalizeTime(endB);

  if (allowTouching && (aEnd === bStart || bEnd === aStart)) {
    return false;
  }

  return aStart < bEnd && aEnd > bStart;
}

async function findExistingBlocksForDay(userId: string, dayOfWeek: DayOfWeek): Promise<Availability[]> {
  return await db.query.availability.findMany({
    where: and(eq(availability.userId, userId), eq(availability.dayOfWeek, dayOfWeek)),
    orderBy: [asc(availability.startTime)],
  });
}

/**
 * Fetches all availability blocks for the authenticated user, ordered by day and start time.
 */
export async function getUserAvailabilityQuery(): Promise<Availability[]> {
  const session = await requireAuth();
  return await db.query.availability.findMany({
    where: eq(availability.userId, session.user.id),
    orderBy: [asc(availability.dayOfWeek), asc(availability.startTime)],
  });
}

/**
 * Fetches the authenticated user's timezone.
 */
export async function getUserTimezoneQuery(): Promise<string> {
  const session = await requireAuth();
  const record = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { timezone: true },
  });
  return record?.timezone ?? "UTC";
}

/**
 * Creates a new availability block for the authenticated user.
 */
export async function createAvailabilityBlockAction(
  input: CreateAvailabilityInput
): Promise<ActionResult<Availability>> {
  try {
    const session = await requireAuth();
    const result = createAvailabilitySchema.safeParse(input);

    if (!result.success) {
      const flattened = result.error.flatten();
      return {
        success: false,
        error: "Validation failed. Please check the fields.",
        fieldErrors: flattened.fieldErrors,
      };
    }

    const { dayOfWeek, startTime, endTime } = result.data;
    const existing = await findExistingBlocksForDay(session.user.id, dayOfWeek);

    for (const block of existing) {
      if (overlaps(startTime, endTime, block.startTime, block.endTime)) {
        return {
          success: false,
          error: "This time block overlaps with an existing availability block.",
        };
      }
    }

    const [newBlock] = await db
      .insert(availability)
      .values({
        userId: session.user.id,
        dayOfWeek,
        startTime,
        endTime,
      })
      .returning();

    revalidatePath("/availability");
    return { success: true, data: newBlock };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to create availability block"),
    };
  }
}

/**
 * Updates an existing availability block ensuring user ownership and no overlaps.
 */
export async function updateAvailabilityBlockAction(
  id: string,
  input: UpdateAvailabilityInput
): Promise<ActionResult<Availability>> {
  try {
    const session = await requireAuth();
    const result = updateAvailabilitySchema.safeParse(input);

    if (!result.success) {
      const flattened = result.error.flatten();
      return {
        success: false,
        error: "Validation failed. Please check the fields.",
        fieldErrors: flattened.fieldErrors,
      };
    }

    const existingBlock = await db.query.availability.findFirst({
      where: and(eq(availability.id, id), eq(availability.userId, session.user.id)),
    });

    if (!existingBlock) {
      return { success: false, error: "Availability block not found or access denied" };
    }

    assertUserOwnership(existingBlock.userId, session.user.id);

    const dayOfWeek = result.data.dayOfWeek ?? existingBlock.dayOfWeek;
    const startTime = result.data.startTime ?? existingBlock.startTime;
    const endTime = result.data.endTime ?? existingBlock.endTime;

    const normalizedStart = normalizeTime(startTime);
    const normalizedEnd = normalizeTime(endTime);

    if (normalizedStart >= normalizedEnd) {
      return { success: false, error: "Start time must be before end time" };
    }

    const sameDayBlocks = await findExistingBlocksForDay(session.user.id, dayOfWeek);

    for (const block of sameDayBlocks) {
      if (block.id === id) continue;
      if (overlaps(normalizedStart, normalizedEnd, block.startTime, block.endTime)) {
        return {
          success: false,
          error: "This time block overlaps with an existing availability block.",
        };
      }
    }

    const [updatedBlock] = await db
      .update(availability)
      .set({
        dayOfWeek,
        startTime: normalizedStart,
        endTime: normalizedEnd,
        updatedAt: new Date(),
      })
      .where(and(eq(availability.id, id), eq(availability.userId, session.user.id)))
      .returning();

    revalidatePath("/availability");
    return { success: true, data: updatedBlock };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to update availability block"),
    };
  }
}

/**
 * Deletes an availability block ensuring user ownership.
 */
export async function deleteAvailabilityBlockAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAuth();

    const existingBlock = await db.query.availability.findFirst({
      where: and(eq(availability.id, id), eq(availability.userId, session.user.id)),
    });

    if (!existingBlock) {
      return { success: false, error: "Availability block not found or access denied" };
    }

    assertUserOwnership(existingBlock.userId, session.user.id);

    await db.delete(availability).where(and(eq(availability.id, id), eq(availability.userId, session.user.id)));

    revalidatePath("/availability");
    return { success: true, data: { id } };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to delete availability block"),
    };
  }
}

/**
 * Deletes all availability blocks for a specific day.
 */
export async function clearAvailabilityForDayAction(
  dayOfWeek: DayOfWeek
): Promise<ActionResult<{ dayOfWeek: DayOfWeek }>> {
  try {
    const session = await requireAuth();

    await db
      .delete(availability)
      .where(and(eq(availability.userId, session.user.id), eq(availability.dayOfWeek, dayOfWeek)));

    revalidatePath("/availability");
    return { success: true, data: { dayOfWeek } };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to clear availability"),
    };
  }
}

/**
 * Updates the authenticated user's timezone.
 */
export async function updateUserTimezoneAction(
  input: UpdateTimezoneInput
): Promise<ActionResult<{ timezone: string }>> {
  try {
    const session = await requireAuth();
    const result = updateTimezoneSchema.safeParse(input);

    if (!result.success) {
      const flattened = result.error.flatten();
      return {
        success: false,
        error: "Invalid timezone",
        fieldErrors: flattened.fieldErrors,
      };
    }

    await db
      .update(user)
      .set({ timezone: result.data.timezone })
      .where(eq(user.id, session.user.id));

    revalidatePath("/availability");
    return { success: true, data: { timezone: result.data.timezone } };
  } catch (err) {
    return {
      success: false,
      error: safeErrorMessage(err, "Failed to update timezone"),
    };
  }
}
