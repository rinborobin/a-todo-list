import type { Subject } from "@/db/schema";
import type { SetupSubject } from "./subject-setup-fields";

/** The fields the setup screens edit, picked from a subject row. */
export function toSetupSubject(s: Subject): SetupSubject {
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    confidence: s.confidence,
    examDate: s.examDate,
    weeklyGoalMinutes: s.weeklyGoalMinutes,
    practiceDaysPerWeek: s.practiceDaysPerWeek,
    resourceName: s.resourceName,
    resourceUnit: s.resourceUnit,
    resourceTotal: s.resourceTotal,
    resourceDone: s.resourceDone,
  };
}
