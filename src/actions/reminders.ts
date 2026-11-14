"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscription, reminderPref, user } from "@/db/schema";
import { requireAuth } from "@/lib/session";
import { safeErrorMessage } from "@/lib/error";
import { takeHourlyQuota } from "@/lib/ai-quota";
import { DEFAULT_REMINDER_PREFS, type ReminderPrefs } from "@/lib/reminders/due";
import { remindersConfigured, sendToDevices, vapidPublicKey } from "@/lib/reminders/send";
import { pushSubscriptionSchema, reminderPrefsSchema, removeSubscriptionSchema } from "@/lib/validations/reminders";

type ActionResult<T = unknown> = { success: true; data: T } | { success: false; error: string };

const TESTS_PER_HOUR = 5;

export interface ReminderState {
  /** False until the server has its notification keys. */
  configured: boolean;
  publicKey: string | null;
  prefs: ReminderPrefs;
  timezone: string;
}

function toPrefs(row: typeof reminderPref.$inferSelect | undefined): ReminderPrefs {
  if (!row) return DEFAULT_REMINDER_PREFS;
  return {
    morningEnabled: row.morningEnabled,
    morningTime: row.morningTime.slice(0, 5),
    deadlineEnabled: row.deadlineEnabled,
    overdueEnabled: row.overdueEnabled,
  };
}

export async function getReminderStateQuery(): Promise<ReminderState> {
  const session = await requireAuth();
  const [prefs, person] = await Promise.all([
    db.query.reminderPref.findFirst({ where: eq(reminderPref.userId, session.user.id) }),
    db.query.user.findFirst({ where: eq(user.id, session.user.id), columns: { timezone: true } }),
  ]);
  return {
    configured: remindersConfigured(),
    publicKey: vapidPublicKey(),
    prefs: toPrefs(prefs),
    timezone: person?.timezone ?? "UTC",
  };
}

/**
 * Registers this device for the signed-in person. Saving the same device again
 * is harmless, and a device that signs in to another account moves to it.
 */
export async function savePushSubscriptionAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const session = await requireAuth();
    if (!remindersConfigured()) return { success: false, error: "Reminders are not set up yet" };
    const parsed = pushSubscriptionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Could not turn on reminders" };

    const { endpoint, keys } = parsed.data;
    await db
      .insert(pushSubscription)
      .values({ userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth },
      });
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not turn on reminders") };
  }
}

/** Removes this device. Only ever touches the caller's own devices. */
export async function removePushSubscriptionAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const session = await requireAuth();
    const parsed = removeSubscriptionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Could not turn off reminders" };
    await db
      .delete(pushSubscription)
      .where(and(eq(pushSubscription.endpoint, parsed.data.endpoint), eq(pushSubscription.userId, session.user.id)));
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not turn off reminders") };
  }
}

export async function updateReminderPrefsAction(input: unknown): Promise<ActionResult<ReminderPrefs>> {
  try {
    const session = await requireAuth();
    const parsed = reminderPrefsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Could not save" };

    const [saved] = await db
      .insert(reminderPref)
      .values({ userId: session.user.id, ...parsed.data })
      .onConflictDoUpdate({ target: reminderPref.userId, set: { ...parsed.data, updatedAt: new Date() } })
      .returning();
    revalidatePath("/me");
    return { success: true, data: toPrefs(saved) };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "Could not save") };
  }
}

/** Sends a sample notification to the caller's own devices. */
export async function sendTestReminderAction(): Promise<ActionResult<{ sent: number }>> {
  try {
    const session = await requireAuth();
    if (!remindersConfigured()) return { success: false, error: "Reminders are not set up yet" };
    if (!(await takeHourlyQuota(`reminder-test:${session.user.id}`, TESTS_PER_HOUR))) {
      return { success: false, error: "That is enough tests for now. Try again in an hour." };
    }

    const devices = await db
      .select({
        id: pushSubscription.id,
        endpoint: pushSubscription.endpoint,
        p256dh: pushSubscription.p256dh,
        auth: pushSubscription.auth,
      })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, session.user.id));
    if (devices.length === 0) return { success: false, error: "Turn on reminders on this device first" };

    const outcome = await sendToDevices(devices, {
      title: "Reminders are on",
      body: "This is how a reminder will look.",
      url: "/me",
      tag: "test",
    });
    if (outcome.sent === 0) return { success: false, error: "The test could not be sent. Try turning reminders off and on." };
    return { success: true, data: { sent: outcome.sent } };
  } catch (err) {
    return { success: false, error: safeErrorMessage(err, "The test could not be sent") };
  }
}
