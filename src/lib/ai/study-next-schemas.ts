import { z } from "zod";

/** What the model sees: aggregated stats only, no session notes. */
export interface StudyNextAiContext {
  currentDate: string;
  timezone: string;
  /** Learned habits, when there is enough history. */
  habits?: {
    usualStudyHours: number[];
    /** How long tasks take relative to their estimate (1.3 = 30% longer). */
    estimateRatio: number | null;
  };
  subjects: {
    id: string;
    name: string;
    /** CLASS, PROJECT (side project) or SELF_LEARNING. Missing means CLASS. */
    kind?: "CLASS" | "PROJECT" | "SELF_LEARNING";
    confidence?: "WEAK" | "OK" | "STRONG" | null;
    /** Classes only. */
    examDate?: string | null;
    /** Self-learning only: when they want to be done. */
    targetDate?: string | null;
    /** Self-learning with a days-a-week target, e.g. "2 of 5 days this week", "keep your 4-day streak". */
    practice?: string | null;
    /** Self-learning: the book or course and where they are in it. */
    resource?: { name: string | null; progress: string; next: string | null } | null;
    /** Side projects: milestones in order; "current" is the one being worked on. */
    milestones?: {
      name: string;
      targetDate: string | null;
      done: boolean;
      current: boolean;
      tasksDone: number;
      tasksTotal: number;
    }[];
    weeklyGoalMinutes?: number | null;
    minutesLast7Days: number;
    daysSinceLastStudied: number | null;
    latestRating: "STRUGGLED" | "OK" | "GOT_IT" | null;
    /** Typical focus length learned from timer sessions, if known. */
    typicalMinutes?: number | null;
    /** Next review date from the memory model (YYYY-MM-DD), if studied before. */
    nextReviewOn?: string | null;
    topics?: {
      id: string;
      name: string;
      daysSinceStudied: number | null;
      lastRating: "STRUGGLED" | "OK" | "GOT_IT" | null;
      nextReviewOn: string | null;
      dueForReview: boolean;
    }[];
    openTasks: {
      id: string;
      title: string;
      deadline: string | null;
      estimatedMinutes: number | null;
      /** Side projects: the milestone the task belongs to. */
      milestone?: string | null;
    }[];
  }[];
}

export const studyNextAiOutputSchema = z.object({
  subjectId: z.string().describe("One of the subject ids from STUDY_DATA."),
  topicId: z
    .string()
    .nullable()
    .default(null)
    .describe("A topic id listed under that same subject, or null."),
  taskId: z
    .string()
    .nullable()
    .describe("An open task id listed under that same subject, or null for general review."),
  minutes: z.number().int().min(15).max(180).describe("Suggested session length in minutes."),
  step: z
    .string()
    .min(1)
    .max(160)
    .describe("One concrete thing to do in this session, e.g. 'Redo the 5 hardest limit problems from week 3'."),
  reason: z.string().min(1).max(300).describe("One or two short sentences addressed to the student."),
});

export type StudyNextAiOutput = z.infer<typeof studyNextAiOutputSchema>;

/**
 * The model may only point at data it was given: a listed subject and, if a
 * topic or task, one listed under that same subject (tasks must be open).
 */
export function validateStudyNext(
  output: StudyNextAiOutput,
  context: StudyNextAiContext
): { valid: boolean; reason?: string } {
  const subject = context.subjects.find((s) => s.id === output.subjectId);
  if (!subject) return { valid: false, reason: "Unknown subject" };
  if (output.topicId !== null && !(subject.topics ?? []).some((t) => t.id === output.topicId)) {
    return { valid: false, reason: "Topic is not part of that subject" };
  }
  if (output.taskId !== null && !subject.openTasks.some((t) => t.id === output.taskId)) {
    return { valid: false, reason: "Task is not an open task of that subject" };
  }
  return { valid: true };
}
