import { getStudyContextQuery } from "@/actions/study";
import { ProgressView } from "@/components/progress/progress-view";
import type { SubjectMeterRow } from "@/components/progress/subject-meters";
import { lastTouched, rankStudyNext } from "@/lib/study/next";
import { dailyTotals, summarizeStudy } from "@/lib/study/stats";
import { buildLearned } from "@/lib/study/learned";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/scheduling/timezone";
import { currentMilestone, milestoneProgress, resourceProgress } from "@/lib/study/progress";
import { describeStreak, practiceStreak } from "@/lib/study/streak";
import type { Subject } from "@/db/schema";

export const metadata = {
  title: "Progress",
};

const DAY_MS = 86_400_000;
const RECENT_DAYS = 14;

export default async function ProgressPage() {
  const study = await getStudyContextQuery();
  const now = new Date();
  const { timezone } = study;

  const active = study.subjects.filter((s) => !s.archivedAt);
  const { totalMinutes7d, bySubject } = summarizeStudy(study.sessions, now);
  // Calendar days in the user's time zone, so "yesterday" means yesterday.
  const today = toLocalDateKey(now, timezone);
  const daysSince = (date: Date | null | undefined) => {
    if (!date) return null;
    const day = toLocalDateKey(date, timezone);
    let n = 0;
    for (let key = day; key < today && n < 3650; key = addDaysToDateKey(key, 1)) n += 1;
    return n;
  };

  // Kind-specific progress under each row.
  const detailFor = (s: Subject): string | null => {
    if (s.kind === "SELF_LEARNING") {
      const parts = [resourceProgress(s)?.doneLabel];
      if (s.practiceDaysPerWeek) {
        const streak = practiceStreak(
          study.sessions.filter((x) => x.subjectId === s.id),
          { now, timezone, daysPerWeek: s.practiceDaysPerWeek }
        );
        const line = describeStreak(streak);
        parts.push(line.charAt(0).toUpperCase() + line.slice(1));
      }
      return parts.filter(Boolean).join(" · ") || null;
    }
    if (s.kind === "PROJECT") {
      const current = currentMilestone(s.id, study.milestones);
      if (!current) return null;
      const { done, total } = milestoneProgress(current.id, study.milestoneTasks);
      return total > 0 ? `${current.name} ${done}/${total} tasks` : current.name;
    }
    return null;
  };

  const subjectRows: SubjectMeterRow[] = active.map((s) => {
    const stat = bySubject.get(s.id);
    return {
      key: s.id,
      name: s.name,
      kind: s.kind,
      minutes7d: stat?.minutes7d ?? 0,
      daysSince: daysSince(
        s.kind === "PROJECT" ? lastTouched(s.id, stat?.lastStudiedAt, study.finishedTasks) : stat?.lastStudiedAt
      ),
      latestRating: stat?.latestRating ?? null,
      detail: detailFor(s),
    };
  });
  const unassigned = bySubject.get(null);
  if (unassigned && unassigned.minutes7d > 0) {
    subjectRows.push({
      key: "none",
      name: "No subject",
      kind: null,
      minutes7d: unassigned.minutes7d,
      daysSince: daysSince(unassigned.lastStudiedAt),
      latestRating: unassigned.latestRating,
      detail: null,
    });
  }
  subjectRows.sort((a, b) => b.minutes7d - a.minutes7d || a.name.localeCompare(b.name));

  const subjectNames = Object.fromEntries(study.subjects.map((s) => [s.id, s.name]));
  const suggestion =
    rankStudyNext({
      subjects: active,
      topics: study.topics,
      milestones: study.milestones,
      finishedTasks: study.finishedTasks,
      openTasks: study.openTasks,
      sessions: study.sessions,
      now,
      timezone,
    })[0] ?? null;
  const running = study.running
    ? {
        id: study.running.id,
        startedAt: study.running.startedAt,
        subjectName: study.running.subjectId ? (subjectNames[study.running.subjectId] ?? null) : null,
        taskTitle: study.running.taskId
          ? (study.openTasks.find((t) => t.id === study.running!.taskId)?.title ?? null)
          : null,
      }
    : null;

  return (
    <ProgressView
      timezone={timezone}
      today={today}
      initialNow={now}
      totalMinutes7d={totalMinutes7d}
      days={dailyTotals(study.sessions, now, timezone, 7)}
      subjectRows={subjectRows}
      sessions={study.sessions.filter((s) => now.getTime() - s.startedAt.getTime() <= RECENT_DAYS * DAY_MS)}
      subjectNames={subjectNames}
      projectIds={study.subjects.filter((s) => s.kind === "PROJECT").map((s) => s.id)}
      taskTitles={study.taskTitles}
      activeSubjects={active.map(({ id, name }) => ({ id, name }))}
      topics={study.topics.filter((t) => !t.archivedAt).map(({ id, name, subjectId }) => ({ id, name, subjectId }))}
      learned={buildLearned({
        subjects: active,
        topics: study.topics,
        sessions: study.sessions,
        finishedTaskEstimates: study.finishedTaskEstimates,
        finishedTasks: study.finishedTasks,
        timezone,
        now,
      })}
      suggestion={suggestion}
      running={running}
    />
  );
}
