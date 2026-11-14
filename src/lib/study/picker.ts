import type { SubjectKind } from "@/db/schema";
import { newTopicsInOrder, type SubjectLike, type TaskLike, type TopicLike } from "./next";
import { isCoachTask, nextProjectTask, type MilestoneLike } from "./progress";
import type { SessionLike } from "./stats";

export interface PickerSubject {
  id: string;
  name: string;
  kind: SubjectKind;
  /** Class and self-learning: topics, the next one to learn first. */
  topics: { id: string; name: string; next: boolean; studied: boolean }[];
  /** Side project: open tasks, the next one first. */
  tasks: { id: string; title: string; next: boolean }[];
}

const KIND_ORDER: Record<SubjectKind, number> = { CLASS: 0, SELF_LEARNING: 1, PROJECT: 2 };
const MAX_TOPICS = 30;
const MAX_TASKS = 15;

/**
 * What "Choose what to study" offers: only the user's own active subjects
 * (classes, then self-learning, then projects), each with its topics or
 * project tasks in a sensible order.
 */
export function toPickerSubjects(input: {
  subjects: (SubjectLike & { kind?: SubjectKind | null })[];
  topics: TopicLike[];
  milestones: MilestoneLike[];
  openTasks: TaskLike[];
  sessions: SessionLike[];
  today: string;
}): PickerSubject[] {
  const { subjects, topics, milestones, openTasks, sessions, today } = input;
  const studied = new Set(sessions.map((s) => s.topicId).filter(Boolean));

  return subjects
    .filter((s) => !s.archivedAt)
    .map((s): PickerSubject => {
      const kind: SubjectKind = s.kind ?? "CLASS";
      if (kind === "PROJECT") {
        const own = openTasks.filter((t) => t.subjectId === s.id && !isCoachTask(t.title));
        const nextId = nextProjectTask(s.id, milestones, own)?.task.id ?? null;
        const ordered = [...own.filter((t) => t.id === nextId), ...own.filter((t) => t.id !== nextId)];
        return {
          id: s.id,
          name: s.name,
          kind,
          topics: [],
          tasks: ordered.slice(0, MAX_TASKS).map((t) => ({ id: t.id, title: t.title, next: t.id === nextId })),
        };
      }
      const own = topics.filter((t) => t.subjectId === s.id && !t.archivedAt);
      const fresh = newTopicsInOrder(own, studied, today);
      const done = own
        .filter((t) => studied.has(t.id))
        .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name));
      return {
        id: s.id,
        name: s.name,
        kind,
        topics: [...fresh, ...done]
          .slice(0, MAX_TOPICS)
          .map((t, i) => ({ id: t.id, name: t.name, next: i === 0 && fresh.length > 0, studied: studied.has(t.id) })),
        tasks: [],
      };
    })
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
}
