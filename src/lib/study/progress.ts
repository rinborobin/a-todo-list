import type { TaskStatus } from "@/db/schema";

export interface ResourceLike {
  resourceName?: string | null;
  resourceUnit?: string | null;
  resourceTotal?: number | null;
  resourceDone?: number | null;
}

export interface ResourceProgress {
  name: string | null;
  unit: string;
  done: number;
  total: number | null;
  finished: boolean;
  /** "Lesson 18 of 40", "Not started", "Finished, 12 lessons" */
  doneLabel: string;
  /** "Lesson 19 of 40", or null when finished. */
  nextLabel: string | null;
  /** "Lesson 19", or null when finished. */
  nextShort: string | null;
}

export interface MilestoneLike {
  id: string;
  subjectId: string;
  name: string;
  /** YYYY-MM-DD */
  targetDate: string | null;
  completedAt: Date | null;
  sortOrder: number;
}

export interface ProjectTaskLike {
  id: string;
  title: string;
  subjectId: string | null;
  milestoneId?: string | null;
  deadline: Date | null;
  estimatedMinutes: number | null;
}

/** Tasks created by "Add to my plan" ("Review: …" / "Study: …"). */
export function isCoachTask(title: string) {
  return title.startsWith("Review: ") || title.startsWith("Study: ");
}

/**
 * Whether ticking a planned block of this task counts as study time. Only the
 * study blocks made by "Add to my plan" do; a to-do such as a submission or a
 * project deadline just gets marked done.
 */
export function countsAsStudy(taskTitle: string | null | undefined): boolean {
  return taskTitle ? isCoachTask(taskTitle) : false;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(unit: string, count: number) {
  return count === 1 || unit.endsWith("s") ? unit : `${unit}s`;
}

/** Where the user is in a book or course, or null when none is tracked. */
export function resourceProgress(subject: ResourceLike): ResourceProgress | null {
  const name = subject.resourceName?.trim() || null;
  const total = subject.resourceTotal ?? null;
  const rawUnit = subject.resourceUnit?.trim() || null;
  if (!name && !total && !rawUnit) return null;

  const unit = (rawUnit ?? "part").toLowerCase();
  const done = Math.max(0, subject.resourceDone ?? 0);
  const finished = total !== null && done >= total;
  const of = (n: number) => `${capitalize(unit)} ${n}${total !== null ? ` of ${total}` : ""}`;

  return {
    name,
    unit,
    done,
    total,
    finished,
    doneLabel: finished ? `Finished, ${total} ${plural(unit, total!)}` : done === 0 ? "Not started" : of(done),
    nextLabel: finished ? null : of(done + 1),
    nextShort: finished ? null : `${capitalize(unit)} ${done + 1}`,
  };
}

function milestoneOrder(a: MilestoneLike, b: MilestoneLike) {
  return (
    a.sortOrder - b.sortOrder ||
    (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") ||
    a.name.localeCompare(b.name)
  );
}

/** Open milestones of a project in the order they should be worked on. */
export function openMilestones(subjectId: string, milestones: MilestoneLike[]): MilestoneLike[] {
  return milestones.filter((m) => m.subjectId === subjectId && !m.completedAt).sort(milestoneOrder);
}

/** The milestone being worked on now: the first open one. */
export function currentMilestone(subjectId: string, milestones: MilestoneLike[]): MilestoneLike | null {
  return openMilestones(subjectId, milestones)[0] ?? null;
}

/** Finished tasks out of all (not cancelled) tasks of one milestone. */
export function milestoneProgress(
  milestoneId: string,
  tasks: { milestoneId?: string | null; status: TaskStatus }[]
): { done: number; total: number } {
  const own = tasks.filter((t) => t.milestoneId === milestoneId && t.status !== "CANCELLED");
  return { done: own.filter((t) => t.status === "COMPLETED").length, total: own.length };
}

/**
 * The next thing to build in a project: a task of the earliest open milestone
 * (nearest deadline first), then later milestones, then tasks that belong to no
 * milestone (or to a finished one).
 */
export function nextProjectTask<T extends ProjectTaskLike>(
  subjectId: string,
  milestones: MilestoneLike[],
  openTasks: T[]
): { task: T; milestone: MilestoneLike | null } | null {
  const open = openMilestones(subjectId, milestones);
  const rank = new Map(open.map((m, i) => [m.id, i]));
  const candidates = openTasks
    .filter((t) => t.subjectId === subjectId && !isCoachTask(t.title))
    .map((task) => ({ task, rank: task.milestoneId ? (rank.get(task.milestoneId) ?? open.length) : open.length }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.task.deadline?.getTime() ?? Infinity) - (b.task.deadline?.getTime() ?? Infinity) ||
        a.task.title.localeCompare(b.task.title)
    );

  const first = candidates[0];
  if (!first) return null;
  return { task: first.task, milestone: first.rank < open.length ? open[first.rank] : null };
}
