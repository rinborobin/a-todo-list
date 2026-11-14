import { z } from "zod";

export const OUTLINE_MAX_TOPICS = 60;
export const TOPIC_NAME_MAX = 80;

/** What the model returns when reading a course outline. */
export const outlineAiOutputSchema = z.object({
  topics: z
    .array(
      z.object({
        name: z.string().describe("The topic as a short title, e.g. 'CSS Flexbox'. No week numbers or dates in it."),
        week: z.number().int().nullable().describe("Week number from the outline, or null."),
        date: z
          .string()
          .nullable()
          .describe("Date the class covers it as YYYY-MM-DD, only if the outline gives a date; otherwise null."),
      })
    )
    .max(80)
    .describe("Topics in the order the course teaches them."),
});

export type OutlineAiOutput = z.infer<typeof outlineAiOutputSchema>;

export interface OutlineTopic {
  name: string;
  week: number | null;
  /** YYYY-MM-DD */
  date: string | null;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/**
 * Cleans what the model read: trimmed one-line names within the length limit,
 * no empty or repeated topics (case-insensitive), at most 60, weeks within
 * 1 to 60, and real dates within a year of today. Anything else is dropped,
 * never guessed.
 */
export function validateOutline(output: OutlineAiOutput, today: string): OutlineTopic[] {
  const seen = new Set<string>();
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const result: OutlineTopic[] = [];

  for (const raw of output.topics) {
    const name = raw.name.replace(/\s+/g, " ").trim().slice(0, TOPIC_NAME_MAX).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const week = raw.week !== null && raw.week >= 1 && raw.week <= 60 ? raw.week : null;
    let date: string | null = null;
    if (raw.date && DATE_KEY.test(raw.date)) {
      const ms = Date.parse(`${raw.date}T00:00:00Z`);
      const valid = !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === raw.date;
      if (valid && Math.abs(ms - todayMs) <= 366 * DAY_MS) date = raw.date;
    }

    result.push({ name, week, date });
    if (result.length >= OUTLINE_MAX_TOPICS) break;
  }
  return result;
}

/** The outline to read: pasted text, or a photo / PDF. */
export type OutlineSource =
  | { kind: "text"; text: string }
  | { kind: "file"; data: Uint8Array; mediaType: string };
