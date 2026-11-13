import type { StudyRating, StudySource, SubjectKind } from "@/db/schema";

export const RATING_LABEL: Record<StudyRating, string> = {
  STRUGGLED: "Struggled",
  OK: "OK",
  GOT_IT: "Got it",
};

export const SOURCE_LABEL: Record<StudySource, string> = {
  BLOCK: "Planned block",
  TIMER: "Timer",
  MANUAL: "Logged",
};

export const KIND_LABEL: Record<SubjectKind, string> = {
  CLASS: "Class",
  PROJECT: "Side project",
  SELF_LEARNING: "Self-learning",
};

export const KIND_OPTIONS: { value: SubjectKind; label: string }[] = [
  { value: "CLASS", label: "Class" },
  { value: "PROJECT", label: "Side project" },
  { value: "SELF_LEARNING", label: "Self-learning" },
];
