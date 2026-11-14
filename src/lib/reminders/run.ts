import "server-only";
import { and, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyPlan, pushSubscription, reminderLog, reminderPref, scheduleItem, subject, task, user } from "@/db/schema";
import { toLocalDateKey } from "@/lib/scheduling/timezone";
import { DEFAULT_REMINDER_PREFS, dueReminders, type ReminderPrefs, type ReminderTask } from "./due";
import { sendToDevices, type PushDevice } from "./send";

const HOUR = 60 * 60 * 1000;
/** Far enough ahead for the day-before reminder, with room for a late run. */
const AHEAD = 26 * HOUR;
/** Far enough back for the morning summary's overdue count. */
const BEHIND = 8 * 24 * HOUR;
const KEEP_LOG = 30 * 24 * HOUR;

export interface ReminderRunResult {
  people: number;
  due: number;
  sent: number;
  alreadySent: number;
  failed: number;
  devicesRemoved: number;
}

/**
 * One pass of the scheduled check: for everyone with a device registered, work
 * out what is due and send it once. Runs outside any session, so every query
 * is keyed by the owner of the device being notified.
 */
export async function runReminders(now: Date): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { people: 0, due: 0, sent: 0, alreadySent: 0, failed: 0, devicesRemoved: 0 };

  const devices = await db
    .select({
      id: pushSubscription.id,
      userId: pushSubscription.userId,
      endpoint: pushSubscription.endpoint,
      p256dh: pushSubscription.p256dh,
      auth: pushSubscription.auth,
    })
    .from(pushSubscription);
  if (devices.length === 0) return result;

  const devicesByUser = new Map<string, PushDevice[]>();
  for (const { userId, ...device } of devices) {
    devicesByUser.set(userId, [...(devicesByUser.get(userId) ?? []), device]);
  }
  const userIds = [...devicesByUser.keys()];
  result.people = userIds.length;

  const [people, prefRows, taskRows] = await Promise.all([
    db.select({ id: user.id, timezone: user.timezone }).from(user).where(inArray(user.id, userIds)),
    db.select().from(reminderPref).where(inArray(reminderPref.userId, userIds)),
    db
      .select({
        id: task.id,
        userId: task.userId,
        title: task.title,
        status: task.status,
        deadline: task.deadline,
        createdAt: task.createdAt,
        subjectName: subject.name,
      })
      .from(task)
      .leftJoin(subject, eq(task.subjectId, subject.id))
      .where(
        and(
          inArray(task.userId, userIds),
          inArray(task.status, ["TODO", "IN_PROGRESS"]),
          isNotNull(task.deadline),
          gte(task.deadline, new Date(now.getTime() - BEHIND)),
          lte(task.deadline, new Date(now.getTime() + AHEAD))
        )
      ),
  ]);

  const prefsByUser = new Map<string, ReminderPrefs>(prefRows.map((row) => [row.userId, row]));
  const tasksByUser = new Map<string, ReminderTask[]>();
  for (const row of taskRows) {
    if (!row.deadline) continue;
    tasksByUser.set(row.userId, [...(tasksByUser.get(row.userId) ?? []), { ...row, deadline: row.deadline }]);
  }

  for (const person of people) {
    const prefs = prefsByUser.get(person.id) ?? DEFAULT_REMINDER_PREFS;
    const [planned] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scheduleItem)
      .innerJoin(dailyPlan, eq(scheduleItem.dailyPlanId, dailyPlan.id))
      .where(
        and(
          eq(dailyPlan.userId, person.id),
          eq(dailyPlan.date, toLocalDateKey(now, person.timezone)),
          eq(scheduleItem.status, "SCHEDULED")
        )
      );

    const reminders = dueReminders({
      now,
      timezone: person.timezone,
      userId: person.id,
      prefs,
      tasks: tasksByUser.get(person.id) ?? [],
      plannedBlocks: planned?.count ?? 0,
    });
    result.due += reminders.length;

    for (const reminder of reminders) {
      // Claim it first. Only the run that wins the insert sends, so a repeated
      // or overlapping run cannot notify twice.
      const [claim] = await db
        .insert(reminderLog)
        .values({ userId: person.id, kind: reminder.kind, dedupeKey: reminder.dedupeKey })
        .onConflictDoNothing({ target: reminderLog.dedupeKey })
        .returning({ id: reminderLog.id });
      if (!claim) {
        result.alreadySent++;
        continue;
      }

      const outcome = await sendToDevices(devicesByUser.get(person.id) ?? [], {
        title: reminder.title,
        body: reminder.body,
        url: reminder.url,
        tag: reminder.dedupeKey,
      });
      result.devicesRemoved += outcome.gone;

      if (outcome.sent > 0) {
        result.sent++;
      } else if (outcome.failed > 0) {
        // Nothing got through for a reason that may pass: let the next run try again.
        await db.delete(reminderLog).where(eq(reminderLog.id, claim.id));
        result.failed++;
      }
    }
  }

  await db.delete(reminderLog).where(lt(reminderLog.sentAt, new Date(now.getTime() - KEEP_LOG)));
  return result;
}
