import { z } from "zod";

export const subjectNameSchema = z
  .string()
  .trim()
  .min(1, "Give the subject a name")
  .max(60, "Keep it under 60 characters");

export const createSubjectSchema = z.object({ name: subjectNameSchema });
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

export const subjectSetupSchema = z.object({
  id: z.string().min(1),
  confidence: SubjectConfidence.nullable().optional(),
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .nullable()
    .optional(),
  weeklyGoalMinutes: z.number().int().min(0).max(2400, "At most 40 hours a week").nullable().optional(),
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
  minutes: z.number().int().min(15).max(180),
  /** YYYY-MM-DD the review is due; the block is planned before the end of it. */
  reviewOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});
