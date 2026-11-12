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

export const startTimerSchema = z.object({
  subjectId: optionalId,
  taskId: optionalId,
});

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
});

export const rateSessionSchema = z.object({
  id: z.string().min(1),
  rating: StudyRating.nullable(),
});

export type CreateSubjectInput = z.input<typeof createSubjectSchema>;
export type LogStudySessionInput = z.input<typeof logStudySessionSchema>;
