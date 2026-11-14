import { z } from "zod";
import { TOPIC_NAME_MAX } from "./outline-schemas";

/** What the model sees to suggest what to learn after a topic. */
export interface NextTopicAiContext {
  subjectName: string;
  kind: "CLASS" | "SELF_LEARNING";
  /** Topics studied, oldest first, with how the last session felt. */
  studied: { name: string; lastRating: "STRUGGLED" | "OK" | "GOT_IT" | null }[];
  /** Topics already listed but not studied (e.g. later in the outline). */
  upcoming: string[];
  /** The topic just finished, if any. */
  justFinished: string | null;
  /** Archived or dismissed topics: do not suggest them again. */
  dismissed: string[];
}

export const nextTopicAiOutputSchema = z.object({
  name: z.string().describe("The next topic as a short title, e.g. 'CSS Grid'."),
  reason: z.string().describe("One short sentence to the student on why it comes next, e.g. 'Builds on Flexbox for two-dimensional layouts.'"),
});

export type NextTopicAiOutput = z.infer<typeof nextTopicAiOutputSchema>;

/**
 * A suggestion must be a new, plausible title: one line, within the length
 * limit, and not a topic the subject already has or one the user dismissed.
 */
export function validateNextTopic(
  output: NextTopicAiOutput,
  context: NextTopicAiContext
): { name: string; reason: string } | null {
  const name = output.name.replace(/\s+/g, " ").trim();
  const reason = output.reason.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!name || name.length > TOPIC_NAME_MAX) return null;
  const taken = new Set(
    [...context.studied.map((t) => t.name), ...context.upcoming, ...context.dismissed, context.subjectName].map((n) =>
      n.toLowerCase()
    )
  );
  if (taken.has(name.toLowerCase())) return null;
  return { name, reason };
}
