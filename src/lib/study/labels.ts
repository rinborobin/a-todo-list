import type { StudyRating, StudySource } from "@/db/schema";

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
