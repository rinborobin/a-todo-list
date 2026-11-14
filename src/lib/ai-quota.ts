import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimit } from "@/db/schema";

const HOUR_MS = 60 * 60 * 1000;

/** Calls per user per hour, by feature. */
export const AI_LIMITS = {
  outline: 10,
  "next-topic": 30,
} as const;

/**
 * Counts one use of `key` and says whether it is within `limit` for the hour.
 * Uses the same table as the login rate limit, with its own keys, so the count
 * holds across serverless instances. The window starts at the first use and
 * resets an hour later.
 */
export async function takeHourlyQuota(key: string, limit: number): Promise<boolean> {
  const now = Date.now();
  const [row] = await db
    .insert(rateLimit)
    .values({ key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} < ${now - HOUR_MS} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${rateLimit.lastRequest} < ${now - HOUR_MS} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count });
  return (row?.count ?? 0) <= limit;
}

/** Counts one AI call for the user and says whether it is within the hourly limit. */
export async function takeAiQuota(userId: string, feature: keyof typeof AI_LIMITS): Promise<boolean> {
  return takeHourlyQuota(`ai:${feature}:${userId}`, AI_LIMITS[feature]);
}
