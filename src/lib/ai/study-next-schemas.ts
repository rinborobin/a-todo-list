import { z } from "zod";

/** What the model sees: aggregated stats only, no session notes. */
export interface StudyNextAiContext {
  currentDate: string;
  timezone: string;
  subjects: {
    id: string;
    name: string;
    minutesLast7Days: number;
    daysSinceLastStudied: number | null;
    latestRating: "STRUGGLED" | "OK" | "GOT_IT" | null;
    openTasks: { id: string; title: string; deadline: string | null; estimatedMinutes: number | null }[];
  }[];
}

export const studyNextAiOutputSchema = z.object({
  subjectId: z.string().describe("One of the subject ids from STUDY_DATA."),
  taskId: z
    .string()
    .nullable()
    .describe("An open task id listed under that same subject, or null for general review."),
  minutes: z.number().int().min(15).max(180).describe("Suggested session length in minutes."),
  reason: z.string().min(1).max(300).describe("One or two short sentences addressed to the student."),
});

export type StudyNextAiOutput = z.infer<typeof studyNextAiOutputSchema>;

/**
 * The model may only point at data it was given: a listed subject and, if a
 * task, an open task of that same subject.
 */
export function validateStudyNext(
  output: StudyNextAiOutput,
  context: StudyNextAiContext
): { valid: boolean; reason?: string } {
  const subject = context.subjects.find((s) => s.id === output.subjectId);
  if (!subject) return { valid: false, reason: "Unknown subject" };
  if (output.taskId !== null && !subject.openTasks.some((t) => t.id === output.taskId)) {
    return { valid: false, reason: "Task is not an open task of that subject" };
  }
  return { valid: true };
}
