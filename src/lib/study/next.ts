import type { SubjectConfidence, SubjectKind } from "@/db/schema";
import { describeDue, formatDuration } from "@/lib/format";
import { toLocalDateKey } from "@/lib/scheduling/timezone";
import { typicalMinutes } from "./habits";
import { replayMemory, reviewStatus } from "./memory";
import { currentMilestone, isCoachTask, nextProjectTask, resourceProgress, type MilestoneLike } from "./progress";
import { summarizeStudy, type SessionLike } from "./stats";
import { describeStreak, practiceStreak } from "./streak";

export type { MilestoneLike } from "./progress";

export interface SubjectLike {
  id: string;
  name: string;
  archivedAt: Date | null;
  /** Defaults to CLASS. */
  kind?: SubjectKind | null;
  confidence?: SubjectConfidence | null;
  /** YYYY-MM-DD. Exam date for a class, target date for self-learning. */
  examDate?: string | null;
  weeklyGoalMinutes?: number | null;
  practiceDaysPerWeek?: number | null;
  resourceName?: string | null;
  resourceUnit?: string | null;
  resourceTotal?: number | null;
  resourceDone?: number | null;
}

export interface TopicLike {
  id: string;
  name: string;
  subjectId: string;
  archivedAt?: Date | null;
}

export interface TaskLike {
  id: string;
  title: string;
  subjectId: string | null;
  milestoneId?: string | null;
  deadline: Date | null;
  estimatedMinutes: number | null;
}

export interface StudyNextSuggestion {
  subjectId: string;
  subjectName: string;
  kind: SubjectKind;
  topicId: string | null;
  topicName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  /** Project: the milestone the suggested task belongs to. */
  milestoneName: string | null;
  /** Self-learning: the next unit of the book or course, when that is the focus ("Lesson 19 of 40"). */
  resourceNext: string | null;
  minutes: number;
  reason: string;
  /** YYYY-MM-DD the focus is due for review, if the model has one. */
  reviewOn: string | null;
  score: number;
}

interface RankInput {
  subjects: SubjectLike[];
  topics?: TopicLike[];
  milestones?: MilestoneLike[];
  openTasks: TaskLike[];
  sessions: SessionLike[];
  now: Date;
  timezone: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_HORIZON_HOURS = 14 * 24;
const EXAM_HORIZON_DAYS = 21;
const TARGET_HORIZON_DAYS = 30;
const MILESTONE_HORIZON_DAYS = 21;
const DEFAULT_MINUTES = 60;
// Confidence from setup matters until there is real history for the subject.
const CONFIDENCE_FADE_REVIEWS = 8;
// "Classes first when urgent": an exam this week or a class task due within
// two days outweighs keeping projects and self-learning moving.
const CLASS_URGENT_EXAM_DAYS = 7;
const CLASS_URGENT_BONUS = 40;

function clampMinutes(minutes: number): number {
  return Math.min(180, Math.max(15, minutes));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function inDays(days: number) {
  return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

function lowerFirstWord(label: string) {
  return label.replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase());
}

/**
 * Ranks active subjects by what most needs attention now, and picks what to do
 * inside the top ones. Deterministic and cheap, so it runs on every page load.
 *
 * Each kind has its own signals:
 * - Class: deadlines, the exam, reviews due by the memory model, how the last
 *   session felt, and setup confidence. An exam this week or a class task due
 *   within two days wins over everything else ("classes first when urgent").
 * - Self-learning: reviews like a class, plus the practice rhythm (days a
 *   week), the target date and the next unit of the book or course.
 * - Side project: no reviews; momentum (days since last touched), the date of
 *   the current milestone and the next task to build.
 * All kinds share the weekly hours goal, or plain balance without one.
 */
export function rankStudyNext({
  subjects,
  topics = [],
  milestones = [],
  openTasks,
  sessions,
  now,
  timezone,
}: RankInput): StudyNextSuggestion[] {
  const today = toLocalDateKey(now, timezone);
  const { totalMinutes7d, bySubject } = summarizeStudy(sessions, now);

  const ranked = subjects
    .filter((s) => !s.archivedAt)
    .map((subject): StudyNextSuggestion => {
      const kind: SubjectKind = subject.kind ?? "CLASS";
      const stat = bySubject.get(subject.id);
      const subjectSessions = sessions.filter((s) => s.subjectId === subject.id);

      let score = 0;
      const reasons: { weight: number; text: string }[] = [];
      const say = (weight: number, text: string) => reasons.push({ weight, text });
      let classUrgent = false;

      // Tasks: overdue or due soon. Review blocks created by "Add to my plan"
      // stand for the review itself, which the memory model already counts.
      const tasks = openTasks.filter((t) => t.subjectId === subject.id);
      const withDeadline = tasks
        .filter((t) => t.deadline && !isCoachTask(t.title))
        .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());
      const urgentTask = withDeadline[0] ?? null;
      if (urgentTask?.deadline) {
        const hoursLeft = (urgentTask.deadline.getTime() - now.getTime()) / 3_600_000;
        if (hoursLeft < 0) {
          score += 60;
          say(60, `${urgentTask.title} is overdue`);
          classUrgent = true;
        } else if (hoursLeft <= DEADLINE_HORIZON_HOURS) {
          const points = 40 * (1 - hoursLeft / DEADLINE_HORIZON_HOURS) + (hoursLeft <= 48 ? 20 : 0);
          score += points;
          say(points, `${urgentTask.title} due ${lowerFirstWord(describeDue(urgentTask.deadline, now, timezone).label)}`);
          if (hoursLeft <= 48) classUrgent = true;
        }
      }

      // Exam (class) or target date (self-learning) coming up
      if (subject.examDate && subject.examDate >= today && kind !== "PROJECT") {
        const days = daysBetween(today, subject.examDate);
        if (kind === "CLASS" && days <= EXAM_HORIZON_DAYS) {
          const points = 35 * (1 - days / EXAM_HORIZON_DAYS) + (days <= 3 ? 15 : 0);
          score += points;
          say(points, days === 0 ? "exam today" : days === 1 ? "exam tomorrow" : `exam in ${days} days`);
          if (days <= CLASS_URGENT_EXAM_DAYS) classUrgent = true;
        } else if (kind === "SELF_LEARNING" && days <= TARGET_HORIZON_DAYS) {
          const points = 20 * (1 - days / TARGET_HORIZON_DAYS) + (days <= 3 ? 8 : 0);
          score += points;
          say(points, `target ${inDays(days)}`);
        }
      }

      if (kind === "CLASS" && classUrgent) score += CLASS_URGENT_BONUS;

      let topic: TopicLike | null = null;
      let task: TaskLike | null = null;
      let milestoneName: string | null = null;
      let resourceNext: string | null = null;
      let reviewOn: string | null = null;

      if (kind === "PROJECT") {
        const next = nextProjectTask(subject.id, milestones, tasks);
        task = next?.task ?? null;
        milestoneName = next?.milestone?.name ?? null;

        // Momentum: the longer it sits untouched, the more it needs a push.
        const last = stat?.lastStudiedAt ?? null;
        if (!last) {
          score += 20;
          say(10, "not started yet");
        } else {
          const idle = daysBetween(toLocalDateKey(last, timezone), today);
          const points = Math.min(30, Math.max(0, idle - 1) * 5);
          score += points;
          if (idle >= 3) say(points, `not touched for ${idle} days`);
        }

        // The milestone being worked on, and its date
        const current = currentMilestone(subject.id, milestones);
        if (current?.targetDate) {
          const days = daysBetween(today, current.targetDate);
          if (days < 0) {
            score += 35;
            say(35, `${current.name} is overdue`);
          } else if (days <= MILESTONE_HORIZON_DAYS) {
            const points = 30 * (1 - days / MILESTONE_HORIZON_DAYS) + (days <= 3 ? 10 : 0);
            score += points;
            say(points, `${current.name} due ${inDays(days)}`);
          }
        }
        if (!milestoneName && task === null && current) milestoneName = current.name;
      } else {
        const memory = replayMemory(subjectSessions, {
          timezone,
          examDate: kind === "CLASS" ? subject.examDate : null,
        });
        const reviews = memory?.reviews ?? 0;
        const resource = kind === "SELF_LEARNING" ? resourceProgress(subject) : null;

        // What to do inside the subject (a due topic, a task, the next lesson, ...)
        const focus = pickFocus({
          subjectId: subject.id,
          topics,
          sessions: subjectSessions,
          tasks,
          urgentTask,
          examDate: kind === "CLASS" ? (subject.examDate ?? null) : null,
          nextUnit: resource?.nextLabel ?? null,
          timezone,
          today,
        });
        topic = focus.topic;
        task = focus.task;
        resourceNext = focus.nextUnit;
        reviewOn = focus.reviewOn ?? memory?.nextReviewOn ?? null;
        if (focus.nextUnit && resource?.nextShort) say(3, `${resource.nextShort} next`);

        // Memory model: is a review due, for the subject or one of its topics?
        // The larger of the two counts, so they do not add up twice.
        const duePoints = (overdueDays: number) => 25 + Math.min(overdueDays, 10) * 3;
        const topicPoints = focus.topicOverdueDays !== null ? duePoints(focus.topicOverdueDays) : 0;
        if (memory) {
          const status = reviewStatus(memory, today);
          const subjectPoints = status.due ? duePoints(status.overdueDays) : 0;
          score += Math.max(subjectPoints, topicPoints);
          if (focus.topicReason) {
            say(Math.max(subjectPoints, topicPoints) + 1, focus.topicReason);
          } else if (status.due) {
            say(
              subjectPoints,
              status.overdueDays > 0
                ? `review overdue by ${status.overdueDays} day${status.overdueDays > 1 ? "s" : ""}`
                : "due for review"
            );
          } else if (status.dueInDays === 1) {
            score += 8;
          }
        } else {
          score += 28;
          say(10, "not studied yet");
        }

        // How the last session felt (the memory model already reacts; this nudges).
        if (stat?.latestRating === "STRUGGLED") {
          score += 6;
          say(6, "last session felt hard");
        } else if (stat?.latestRating === "GOT_IT") {
          score -= 5;
        }

        // Setup confidence: strong at the start, fades as history builds up
        const fade = Math.max(0, 1 - reviews / CONFIDENCE_FADE_REVIEWS);
        if (subject.confidence === "WEAK") {
          score += 15 * fade;
          if (reviews === 0) say(14, "you marked it as weak");
        } else if (subject.confidence === "OK") {
          score += 5 * fade;
        }

        // Practice rhythm (self-learning): behind this week, or a streak that ends today
        if (kind === "SELF_LEARNING" && subject.practiceDaysPerWeek) {
          const streak = practiceStreak(subjectSessions, { now, timezone, daysPerWeek: subject.practiceDaysPerWeek });
          if (!streak.practicedToday && streak.needed > 0) {
            const pressure = Math.min(1, streak.needed / Math.max(1, streak.daysLeft));
            const points = 20 * pressure + (streak.atRisk ? 12 : 0);
            score += points;
            say(points, describeStreak(streak));
          }
        }
      }

      // Weekly goal, or plain balance when there is no goal
      const goal = subject.weeklyGoalMinutes ?? 0;
      const minutes7d = stat?.minutes7d ?? 0;
      if (goal > 0) {
        const deficit = Math.max(0, 1 - minutes7d / goal);
        score += 18 * deficit;
        if (deficit >= 0.25) say(18 * deficit, `${formatDuration(minutes7d) || "0m"} of ${formatDuration(goal)} this week`);
      } else {
        const share = totalMinutes7d > 0 ? minutes7d / totalMinutes7d : 0;
        score += totalMinutes7d > 0 ? (1 - share) * 10 : 5;
      }

      const learned = typicalMinutes(subjectSessions.map((s) => ({ minutes: s.minutes, source: s.source ?? "MANUAL" })));
      const minutes = clampMinutes(learned ?? task?.estimatedMinutes ?? DEFAULT_MINUTES);

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        kind,
        topicId: topic?.id ?? null,
        topicName: topic?.name ?? null,
        taskId: task?.id ?? null,
        taskTitle: task?.title ?? null,
        milestoneName,
        resourceNext,
        minutes,
        reason: reasons
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 2)
          .map((r) => r.text)
          .join(" · "),
        reviewOn,
        score,
      };
    });

  return ranked.sort((a, b) => b.score - a.score || a.subjectName.localeCompare(b.subjectName));
}

/**
 * Inside a class or self-learning subject: a topic due for review comes first
 * (most overdue), then the task with the nearest deadline, then the next unit
 * of the book or course, then the topic coming up soonest, then any open task.
 */
function pickFocus(input: {
  subjectId: string;
  topics: TopicLike[];
  sessions: SessionLike[];
  tasks: TaskLike[];
  urgentTask: TaskLike | null;
  examDate: string | null;
  nextUnit: string | null;
  timezone: string;
  today: string;
}): {
  topic: TopicLike | null;
  task: TaskLike | null;
  nextUnit: string | null;
  topicReason: string | null;
  /** Days the chosen topic is overdue (0 = due today), or null if no topic is due. */
  topicOverdueDays: number | null;
  reviewOn: string | null;
} {
  const { subjectId, topics, sessions, tasks, urgentTask, examDate, nextUnit, timezone, today } = input;
  const none = { topic: null, task: null, nextUnit: null, topicReason: null, topicOverdueDays: null, reviewOn: null };

  const topicStates = topics
    .filter((t) => t.subjectId === subjectId && !t.archivedAt)
    .map((topic) => {
      const memory = replayMemory(
        sessions.filter((s) => s.topicId === topic.id),
        { timezone, examDate }
      );
      return { topic, memory, status: memory ? reviewStatus(memory, today) : null };
    })
    .filter((t) => t.memory !== null);

  const due = topicStates
    .filter((t) => t.status!.due)
    .sort((a, b) => b.status!.overdueDays - a.status!.overdueDays || a.topic.name.localeCompare(b.topic.name));
  if (due.length > 0) {
    const { topic, memory, status } = due[0];
    const hard = memory!.lastRating === "STRUGGLED" ? " · felt hard last time" : "";
    return {
      ...none,
      topic,
      topicReason: `${topic.name} due for review${hard}`,
      topicOverdueDays: status!.overdueDays,
      reviewOn: memory!.nextReviewOn,
    };
  }

  if (urgentTask) return { ...none, task: urgentTask };
  if (nextUnit) return { ...none, nextUnit };

  const upcoming = [...topicStates].sort((a, b) => a.memory!.nextReviewOn.localeCompare(b.memory!.nextReviewOn))[0];
  if (upcoming) return { ...none, topic: upcoming.topic, reviewOn: upcoming.memory!.nextReviewOn };

  return { ...none, task: tasks.find((t) => !isCoachTask(t.title)) ?? tasks[0] ?? null };
}
