import "server-only";
import webpush, { WebPushError } from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscription } from "@/db/schema";

export interface PushMessage {
  title: string;
  body: string;
  /** Path inside the app that a tap opens. */
  url: string;
  /** A later notification with the same tag replaces the earlier one. */
  tag: string;
}

export interface PushDevice {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type SendOutcome = "sent" | "gone" | "failed";

/** How long a push service keeps a reminder for a phone that is offline. */
const TTL_SECONDS = 4 * 60 * 60;
const TIMEOUT_MS = 10_000;

/**
 * The key pair that identifies this app to push services. Optional: without
 * it the app runs as before and reminders show as not set up.
 */
function vapidDetails(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const appUrl = process.env.BETTER_AUTH_URL;
  if (!publicKey || !privateKey || !appUrl) return null;
  try {
    // Push services want a contact for the sender. The app's own address is
    // used, never a person's email. It must be https, so local http is upgraded.
    const subject = new URL(appUrl);
    subject.protocol = "https:";
    return { subject: subject.origin, publicKey, privateKey };
  } catch {
    return null;
  }
}

export function remindersConfigured(): boolean {
  return vapidDetails() !== null;
}

/** Safe to hand to the browser: it is the public half of the key pair. */
export function vapidPublicKey(): string | null {
  return vapidDetails()?.publicKey ?? null;
}

/**
 * Sends one notification to one device. A device the push service no longer
 * knows (the app was removed, or notifications were switched off) is deleted.
 */
export async function sendToDevice(device: PushDevice, message: PushMessage): Promise<SendOutcome> {
  const vapid = vapidDetails();
  if (!vapid) return "failed";
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(message),
      { vapidDetails: vapid, TTL: TTL_SECONDS, timeout: TIMEOUT_MS }
    );
    await db.update(pushSubscription).set({ lastOkAt: new Date() }).where(eq(pushSubscription.id, device.id));
    return "sent";
  } catch (err) {
    const status = err instanceof WebPushError ? err.statusCode : 0;
    if (status === 404 || status === 410) {
      await db.delete(pushSubscription).where(eq(pushSubscription.id, device.id));
      return "gone";
    }
    // The endpoint is a capability for that device, so it is not logged.
    console.error("Reminder could not be sent", status || (err instanceof Error ? err.name : "unknown"));
    return "failed";
  }
}

export async function sendToDevices(
  devices: PushDevice[],
  message: PushMessage
): Promise<Record<SendOutcome, number>> {
  const outcomes = await Promise.all(devices.map((device) => sendToDevice(device, message)));
  const count = (outcome: SendOutcome) => outcomes.filter((o) => o === outcome).length;
  return { sent: count("sent"), gone: count("gone"), failed: count("failed") };
}
