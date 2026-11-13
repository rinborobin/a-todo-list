import type { StudyRating } from "@/db/schema";
import { toLocalDateKey } from "@/lib/scheduling/timezone";
import { estimateRatio, typicalMinutes, usualHours } from "./habits";
import { replayMemory, reviewStatus } from "./memory";
import type { SubjectLike, TopicLike } from "./next";
import type { SessionLike } from "./stats";
import { describeStreak, practiceStreak } from "./streak";

export interface ReviewItem {
  key: string;
  subjectName: string;
  topicName: string | null;
  nextReviewOn: string;
  overdueDays: number;
  dueInDays: number;
  lastRating: StudyRating | null;
}

export interface Learned {
  sessionsCount: number;
  /** Reviews due now or within the next 7 days, soonest first. */
  reviewQueue: ReviewItem[];
  typicalBySubject: { subjectName: string; minutes: number }[];
  usualHours: number[];
  estimateRatio: number | null;
  /** Side projects, longest untouched first; idleDays is null when never touched. */
  projects: { subjectName: string; idleDays: number | null }[];
  /** Self-learning with a days-a-week target: "5-day streak", "2 of 3 days this week". */
  practice: { subjectName: string; line: string }[];
}

const QUEUE_HORIZON_DAYS = 7;

/**
 * What the model currently believes, in a form the Progress screen can show:
 * which topics (or subjects without topics) are due for review, and the habits
 * learned from sessions.
 */
export function buildLearned(input: {
  subjects: SubjectLike[];
  topics: TopicLike[];
  sessions: (SessionLike & { source: NonNullable<SessionLike["source"]> })[];
  finishedTaskEstimates: { estimatedMinutes: number; actualMinutes: number }[];
  timezone: string;
  now: Date;
}): Learned {
  const { subjects, topics, sessions, finishedTaskEstimates, timezone, now } = input;
  const today = toLocalDateKey(now, timezone);
  const active = subjects.filter((s) => !s.archivedAt);
  const queue: ReviewItem[] = [];

  for (const subject of active) {
    // Projects are built, not memorised: no reviews.
    if (subject.kind === "PROJECT") continue;
    const subjectSessions = sessions.filter((s) => s.subjectId === subject.id);
    const subjectTopics = topics.filter((t) => t.subjectId === subject.id && !t.archivedAt);
    let topicEntries = 0;

    for (const topic of subjectTopics) {
      const memory = replayMemory(
        subjectSessions.filter((s) => s.topicId === topic.id),
        { timezone, examDate: subject.kind === "SELF_LEARNING" ? null : subject.examDate }
      );
      if (!memory) continue;
      topicEntries += 1;
      const status = reviewStatus(memory, today);
      queue.push({
        key: topic.id,
        subjectName: subject.name,
        topicName: topic.name,
        nextReviewOn: memory.nextReviewOn,
        overdueDays: status.overdueDays,
        dueInDays: status.dueInDays,
        lastRating: memory.lastRating,
      });
    }

    // Subjects studied without topics still get one entry for the whole subject.
    if (topicEntries === 0) {
      const memory = replayMemory(subjectSessions, {
        timezone,
        examDate: subject.kind === "SELF_LEARNING" ? null : subject.examDate,
      });
      if (memory) {
        const status = reviewStatus(memory, today);
        queue.push({
          key: subject.id,
          subjectName: subject.name,
          topicName: null,
          nextReviewOn: memory.nextReviewOn,
          overdueDays: status.overdueDays,
          dueInDays: status.dueInDays,
          lastRating: memory.lastRating,
        });
      }
    }
  }

  const recent = sessions.filter((s) => now.getTime() - s.startedAt.getTime() <= 60 * 86_400_000);

  return {
    sessionsCount: sessions.length,
    reviewQueue: queue
      .filter((item) => item.dueInDays <= QUEUE_HORIZON_DAYS)
      .sort((a, b) => a.dueInDays - b.dueInDays || a.subjectName.localeCompare(b.subjectName)),
    typicalBySubject: active
      .map((subject) => ({
        subjectName: subject.name,
        minutes: typicalMinutes(recent.filter((s) => s.subjectId === subject.id)),
      }))
      .filter((row): row is { subjectName: string; minutes: number } => row.minutes !== null),
    usualHours: usualHours(recent, timezone),
    estimateRatio: estimateRatio(finishedTaskEstimates),
    projects: active
      .filter((subject) => subject.kind === "PROJECT")
      .map((subject) => {
        const last = sessions
          .filter((s) => s.subjectId === subject.id)
          .reduce<Date | null>((latest, s) => (!latest || s.startedAt > latest ? s.startedAt : latest), null);
        const idleDays = last
          ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${toLocalDateKey(last, timezone)}T00:00:00Z`)) / 86_400_000)
          : null;
        return { subjectName: subject.name, idleDays };
      })
      .sort((a, b) => (b.idleDays ?? Infinity) - (a.idleDays ?? Infinity) || a.subjectName.localeCompare(b.subjectName)),
    practice: active
      .filter((subject) => subject.kind === "SELF_LEARNING" && subject.practiceDaysPerWeek)
      .map((subject) => ({
        subjectName: subject.name,
        line: describeStreak(
          practiceStreak(
            sessions.filter((s) => s.subjectId === subject.id),
            { now, timezone, daysPerWeek: subject.practiceDaysPerWeek! }
          )
        ),
      })),
  };
}
