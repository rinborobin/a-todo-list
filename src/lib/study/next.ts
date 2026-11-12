import type { SubjectConfidence } from "@/db/schema";
import { describeDue, formatDuration } from "@/lib/format";
import { toLocalDateKey } from "@/lib/scheduling/timezone";
import { typicalMinutes } from "./habits";
import { replayMemory, reviewStatus } from "./memory";
import { summarizeStudy, type SessionLike } from "./stats";

export interface SubjectLike {
  id: string;
  name: string;
  archivedAt: Date | null;
  confidence?: SubjectConfidence | null;
  /** YYYY-MM-DD */
  examDate?: string | null;
  weeklyGoalMinutes?: number | null;
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
  deadline: Date | null;
  estimatedMinutes: number | null;
}

export interface StudyNextSuggestion {
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  minutes: number;
  reason: string;
  /** YYYY-MM-DD the focus is due for review, if the model has one. */
  reviewOn: string | null;
  score: number;
}

interface RankInput {
  subjects: SubjectLike[];
  topics?: TopicLike[];
  openTasks: TaskLike[];
  sessions: SessionLike[];
  now: Date;
  timezone: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_HORIZON_HOURS = 14 * 24;
const EXAM_HORIZON_DAYS = 21;
const DEFAULT_MINUTES = 60;
// Confidence from setup matters until there is real history for the subject.
const CONFIDENCE_FADE_REVIEWS = 8;

function clampMinutes(minutes: number): number {
  return Math.min(180, Math.max(15, minutes));
}

function daysUntil(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

function lowerFirstWord(label: string) {
  return label.replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase());
}

/**
 * Ranks active subjects by what most needs attention now, and picks what to
 * do inside the top ones. Deterministic and cheap, so it runs on every page
 * load. Signals, roughly by weight: an overdue task or near deadline, an exam
 * coming up, a review due by the memory model, falling behind a weekly goal,
 * how the last session felt, and (before there is history) the confidence set
 * during setup.
 */
export function rankStudyNext({ subjects, topics = [], openTasks, sessions, now, timezone }: RankInput): StudyNextSuggestion[] {
  const today = toLocalDateKey(now, timezone);
  const { totalMinutes7d, bySubject } = summarizeStudy(sessions, now);

  const ranked = subjects
    .filter((s) => !s.archivedAt)
    .map((subject): StudyNextSuggestion => {
      const stat = bySubject.get(subject.id);
      const subjectSessions = sessions.filter((s) => s.subjectId === subject.id);
      const memory = replayMemory(subjectSessions, { timezone, examDate: subject.examDate });
      const reviews = memory?.reviews ?? 0;

      let score = 0;
      const reasons: { weight: number; text: string }[] = [];
      const say = (weight: number, text: string) => reasons.push({ weight, text });

      // Tasks: overdue or due soon
      const tasks = openTasks.filter((t) => t.subjectId === subject.id);
      const withDeadline = tasks
        .filter((t) => t.deadline)
        .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());
      const urgentTask = withDeadline[0] ?? null;
      if (urgentTask?.deadline) {
        const hoursLeft = (urgentTask.deadline.getTime() - now.getTime()) / 3_600_000;
        if (hoursLeft < 0) {
          score += 60;
          say(60, `${urgentTask.title} is overdue`);
        } else if (hoursLeft <= DEADLINE_HORIZON_HOURS) {
          const points = 40 * (1 - hoursLeft / DEADLINE_HORIZON_HOURS) + (hoursLeft <= 48 ? 20 : 0);
          score += points;
          say(points, `${urgentTask.title} due ${lowerFirstWord(describeDue(urgentTask.deadline, now, timezone).label)}`);
        }
      }

      // Exam coming up
      if (subject.examDate && subject.examDate >= today) {
        const days = daysUntil(today, subject.examDate);
        if (days <= EXAM_HORIZON_DAYS) {
          const points = 35 * (1 - days / EXAM_HORIZON_DAYS) + (days <= 3 ? 15 : 0);
          score += points;
          say(points, days === 0 ? "exam today" : days === 1 ? "exam tomorrow" : `exam in ${days} days`);
        }
      }

      // What to do inside the subject (a due topic, a task, ...)
      const focus = pickFocus({
        subjectId: subject.id,
        topics,
        sessions: subjectSessions,
        tasks,
        urgentTask,
        examDate: subject.examDate ?? null,
        timezone,
        today,
      });

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
          say(subjectPoints, status.overdueDays > 0 ? `review overdue by ${status.overdueDays} day${status.overdueDays > 1 ? "s" : ""}` : "due for review");
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

      // Setup confidence: strong at the start, fades as history builds up
      const fade = Math.max(0, 1 - reviews / CONFIDENCE_FADE_REVIEWS);
      if (subject.confidence === "WEAK") {
        score += 15 * fade;
        if (reviews === 0) say(14, "you marked it as weak");
      } else if (subject.confidence === "OK") {
        score += 5 * fade;
      }

      const learned = typicalMinutes(subjectSessions.map((s) => ({ minutes: s.minutes, source: s.source ?? "MANUAL" })));
      const minutes = clampMinutes(learned ?? focus.task?.estimatedMinutes ?? DEFAULT_MINUTES);

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        topicId: focus.topic?.id ?? null,
        topicName: focus.topic?.name ?? null,
        taskId: focus.task?.id ?? null,
        taskTitle: focus.task?.title ?? null,
        minutes,
        reason: reasons
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 2)
          .map((r) => r.text)
          .join(" · "),
        reviewOn: focus.reviewOn ?? memory?.nextReviewOn ?? null,
        score,
      };
    });

  return ranked.sort((a, b) => b.score - a.score || a.subjectName.localeCompare(b.subjectName));
}

/**
 * Inside a subject: a topic due for review comes first (most overdue), then the
 * task with the nearest deadline, then the topic coming up soonest, then any
 * open task. Returns null focus when there is nothing more specific.
 */
function pickFocus(input: {
  subjectId: string;
  topics: TopicLike[];
  sessions: SessionLike[];
  tasks: TaskLike[];
  urgentTask: TaskLike | null;
  examDate: string | null;
  timezone: string;
  today: string;
}): {
  topic: TopicLike | null;
  task: TaskLike | null;
  topicReason: string | null;
  /** Days the chosen topic is overdue (0 = due today), or null if no topic is due. */
  topicOverdueDays: number | null;
  reviewOn: string | null;
} {
  const { subjectId, topics, sessions, tasks, urgentTask, examDate, timezone, today } = input;

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
      topic,
      task: null,
      topicReason: `${topic.name} due for review${hard}`,
      topicOverdueDays: status!.overdueDays,
      reviewOn: memory!.nextReviewOn,
    };
  }

  if (urgentTask) return { topic: null, task: urgentTask, topicReason: null, topicOverdueDays: null, reviewOn: null };

  const upcoming = [...topicStates].sort((a, b) => a.memory!.nextReviewOn.localeCompare(b.memory!.nextReviewOn))[0];
  if (upcoming) {
    return {
      topic: upcoming.topic,
      task: null,
      topicReason: null,
      topicOverdueDays: null,
      reviewOn: upcoming.memory!.nextReviewOn,
    };
  }

  return { topic: null, task: tasks[0] ?? null, topicReason: null, topicOverdueDays: null, reviewOn: null };
}
