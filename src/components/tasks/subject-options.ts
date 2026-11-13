import type { Milestone, Subject, SubjectKind } from "@/db/schema";

/** A subject as the task screens need it: kind and its milestones for projects. */
export interface TaskSubjectOption {
  id: string;
  name: string;
  archived: boolean;
  kind: SubjectKind;
  milestones: { id: string; name: string; done: boolean }[];
}

export function toTaskSubjectOptions(subjects: Subject[], milestones: Milestone[]): TaskSubjectOption[] {
  return subjects.map((s) => ({
    id: s.id,
    name: s.name,
    archived: s.archivedAt !== null,
    kind: s.kind,
    milestones: milestones
      .filter((m) => m.subjectId === s.id)
      .map((m) => ({ id: m.id, name: m.name, done: m.completedAt !== null })),
  }));
}
