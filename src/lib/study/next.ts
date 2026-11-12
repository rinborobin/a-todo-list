import { describeDue } from "@/lib/format";
import { summarizeStudy, type SessionLike } from "./stats";

export interface SubjectLike {
  id: string;
  name: string;
  archivedAt: Date | null;
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
  taskId: string | null;
  taskTitle: string | null;
  minutes: number;
  reason: string;
  score: number;
}

interface RankInput {
  subjects: SubjectLike[];
  openTasks: TaskLike[];
  sessions: SessionLike[];
  now: Date;
  timezone: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_HORIZON_HOURS = 14 * 24;
const DEFAULT_MINUTES = 60;

function clampMinutes(minutes: number | null): number {
  return Math.min(180, Math.max(15, minutes ?? DEFAULT_MINUTES));
}

/**
 * Ranks active subjects by how much they need attention now. Deterministic and
 * cheap, so it can run on every Today load. Factors, in rough order of weight:
 * an upcoming or overdue deadline, days since last studied, a recent
 * "struggled" rating, and a small share of this week's study time.
 */
export function rankStudyNext({ subjects, openTasks, sessions, now, timezone }: RankInput): StudyNextSuggestion[] {
  const { totalMinutes7d, bySubject } = summarizeStudy(sessions, now);

  const ranked = subjects
    .filter((s) => !s.archivedAt)
    .map((subject) => {
      const stat = bySubject.get(subject.id);
      const tasks = openTasks.filter((t) => t.subjectId === subject.id);
      const withDeadline = tasks
        .filter((t) => t.deadline)
        .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());
      const focus = withDeadline[0] ?? tasks[0] ?? null;

      let score = 0;
      const reasons: string[] = [];

      // Deadline pressure
      if (focus?.deadline) {
        const hoursLeft = (focus.deadline.getTime() - now.getTime()) / 3_600_000;
        const due = describeDue(focus.deadline, now, timezone);
        if (hoursLeft < 0) {
          score += 60;
          reasons.push(`${focus.title} is overdue`);
        } else if (hoursLeft <= DEADLINE_HORIZON_HOURS) {
          score += 40 * (1 - hoursLeft / DEADLINE_HORIZON_HOURS) + (hoursLeft <= 48 ? 20 : 0);
          reasons.push(`${focus.title} due ${due.label.replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}`);
        }
      }

      // Time since last studied
      const daysSince = stat?.lastStudiedAt
        ? Math.floor((now.getTime() - stat.lastStudiedAt.getTime()) / DAY_MS)
        : null;
      score += Math.min(daysSince ?? 14, 14) * 2;
      if (daysSince === null) reasons.push("not studied yet");
      else if (daysSince >= 2) reasons.push(`last studied ${daysSince} days ago`);

      // How the last session felt
      if (stat?.latestRating === "STRUGGLED") {
        score += 12;
        reasons.push("last session felt hard");
      } else if (stat?.latestRating === "GOT_IT") {
        score -= 5;
      }

      // Balance across subjects this week
      const share = totalMinutes7d > 0 ? (stat?.minutes7d ?? 0) / totalMinutes7d : 0;
      score += totalMinutes7d > 0 ? (1 - share) * 10 : 5;

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        taskId: focus?.id ?? null,
        taskTitle: focus?.title ?? null,
        minutes: clampMinutes(focus?.estimatedMinutes ?? null),
        reason: reasons.slice(0, 2).join(" · "),
        score,
      };
    });

  return ranked.sort((a, b) => b.score - a.score || a.subjectName.localeCompare(b.subjectName));
}
