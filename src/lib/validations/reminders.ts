import { z } from "zod";
import { isPushServiceEndpoint } from "@/lib/reminders/endpoint";

const base64Url = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+=*$/, "Invalid key");

const endpoint = z.string().refine(isPushServiceEndpoint, "This browser's notification service is not supported");

/** What the browser hands over when the person allows notifications. */
export const pushSubscriptionSchema = z.object({
  endpoint,
  keys: z.object({
    p256dh: base64Url(40, 200),
    auth: base64Url(8, 100),
  }),
});

export const removeSubscriptionSchema = z.object({ endpoint });

export const reminderPrefsSchema = z
  .object({
    morningEnabled: z.boolean(),
    morningTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time"),
    deadlineEnabled: z.boolean(),
    overdueEnabled: z.boolean(),
  })
  .partial();
