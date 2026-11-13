import type { Subject } from "@/db/schema";
import { resourceProgress } from "@/lib/study/progress";
import type { RailSubject } from "./day-rail";

/** What the day rail needs to know about each subject after a block is ticked. */
export function toRailSubjects(subjects: Subject[]): RailSubject[] {
  return subjects.map((s) => ({
    id: s.id,
    kind: s.kind,
    resourceNext: s.kind === "SELF_LEARNING" ? (resourceProgress(s)?.nextShort ?? null) : null,
  }));
}
