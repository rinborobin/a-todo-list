import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders/run";
import { remindersConfigured } from "@/lib/reminders/send";

export const maxDuration = 60;

/**
 * Called by the scheduler every 15 minutes. The address is public, so nothing
 * happens without the shared secret, and the reply carries counts only.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  if (!remindersConfigured()) return Response.json({ configured: false });

  try {
    return Response.json({ configured: true, ...(await runReminders(new Date())) });
  } catch (err) {
    console.error("Reminder run failed", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "Reminder run failed" }, { status: 500 });
  }
}
