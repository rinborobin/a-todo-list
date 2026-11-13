import { z } from "zod";

export const subjectNameSchema = z
  .string()
  .trim()
  .min(1, "Give the subject a name")
  .max(60, "Keep it under 60 characters");

export const SubjectKind = z.enum(["CLASS", "PROJECT", "SELF_LEARNING"]);
export type SubjectKindValue = z.infer<typeof SubjectKind>;

export const createSubjectSchema = z.object({ name: subjectNameSchema, kind: SubjectKind.optional() });
export const renameSubjectSchema = z.object({ id: z.string().min(1), name: subjectNameSchema });

export const StudyRating = z.enum(["STRUGGLED", "OK", "GOT_IT"]);
export type StudyRatingValue = z.infer<typeof StudyRating>;

const optionalId = z.string().min(1).nullable().optional();

const goalMinutes = z.number().int().min(5, "At least 5 minutes").max(480, "At most 8 hours");

export const startTimerSchema = z.object({
  subjectId: optionalId,
  taskId: optionalId,
  topicId: optionalId,
  plannedMinutes: goalMinutes.optional(),
});

export const setGoalSchema = z.object({ minutes: goalMinutes });

export const logStudySessionSchema = z.object({
  subjectId: optionalId,
  minutes: z.coerce
    .number()
    .int("Use whole minutes")
    .min(1, "At least 1 minute")
    .max(720, "At most 12 hours in one session"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  rating: StudyRating.nullable().optional(),
  note: z.string().trim().max(500, "Keep the note under 500 characters").nullable().optional(),
  // Declared below, so referenced lazily.
  topic: z.lazy(() => topicChoiceSchema).optional(),
});

export const rateSessionSchema = z.object({
  id: z.string().min(1),
  rating: StudyRating.nullable(),
});

export type CreateSubjectInput = z.input<typeof createSubjectSchema>;
export type LogStudySessionInput = z.input<typeof logStudySessionSchema>;

export const SubjectConfidence = z.enum(["WEAK", "OK", "STRONG"]);

/** Trimmed text; empty becomes null so a cleared field is stored as nothing. */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));
}

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const subjectSetupSchema = z.object({
  id: z.string().min(1),
  confidence: SubjectConfidence.nullable().optional(),
  /** Exam date for a class, target date for self-learning. */
  examDate: dateKey.nullable().optional(),
  weeklyGoalMinutes: z.number().int().min(0).max(2400, "At most 40 hours a week").nullable().optional(),
  kind: SubjectKind.optional(),
  practiceDaysPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  resourceName: optionalText(80, "Keep the name under 80 characters"),
  resourceUnit: optionalText(20, "Keep the unit short, like lesson or chapter"),
  resourceTotal: z.number().int().min(1, "At least 1").max(10000, "At most 10000").nullable().optional(),
  resourceDone: z.number().int().min(0).max(10000).optional(),
});

export type SubjectSetupInput = z.input<typeof subjectSetupSchema>;

export const topicNameSchema = z.string().trim().min(1, "Name the topic").max(80, "Keep it under 80 characters");

/** Either an existing topic, a new topic name, or null to clear. */
export const topicChoiceSchema = z.union([
  z.object({ topicId: z.string().min(1).nullable() }),
  z.object({ newName: topicNameSchema }),
]);

export const setSessionTopicSchema = z.object({
  sessionId: z.string().min(1),
  choice: topicChoiceSchema,
});

export const renameTopicSchema = z.object({ id: z.string().min(1), name: topicNameSchema });

export const planStudyBlockSchema = z.object({
  subjectId: z.string().min(1),
  topicId: z.string().min(1).nullable().optional(),
  /** An existing open task to plan instead of a study block (a project's next task). */
  taskId: z.string().min(1).nullable().optional(),
  minutes: z.number().int().min(15).max(180),
  /** YYYY-MM-DD the review is due; the block is planned before the end of it. */
  reviewOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const advanceResourceSchema = z.object({
  subjectId: z.string().min(1),
  delta: z.number().int().min(-10).max(10),
});

export const milestoneNameSchema = z.string().trim().min(1, "Name the milestone").max(60, "Keep it under 60 characters");

export const createMilestoneSchema = z.object({
  subjectId: z.string().min(1),
  name: milestoneNameSchema,
  targetDate: dateKey.nullable().optional(),
});

export const updateMilestoneSchema = z.object({
  id: z.string().min(1),
  name: milestoneNameSchema.optional(),
  targetDate: dateKey.nullable().optional(),
  done: z.boolean().optional(),
  move: z.enum(["up", "down"]).optional(),
});
