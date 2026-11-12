import { getStudyContextQuery } from "@/actions/study";
import { ProgressView } from "@/components/progress/progress-view";
import type { SubjectMeterRow } from "@/components/progress/subject-meters";
import { rankStudyNext } from "@/lib/study/next";
import { dailyTotals, summarizeStudy } from "@/lib/study/stats";
import { toLocalDateKey } from "@/lib/scheduling/timezone";

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
  const daysSince = (date: Date | null | undefined) =>
    date ? Math.floor((now.getTime() - date.getTime()) / DAY_MS) : null;

  const subjectRows: SubjectMeterRow[] = active.map((s) => {
    const stat = bySubject.get(s.id);
    return {
      key: s.id,
      name: s.name,
      minutes7d: stat?.minutes7d ?? 0,
      daysSince: daysSince(stat?.lastStudiedAt),
      latestRating: stat?.latestRating ?? null,
    };
  });
  const unassigned = bySubject.get(null);
  if (unassigned && unassigned.minutes7d > 0) {
    subjectRows.push({
      key: "none",
      name: "No subject",
      minutes7d: unassigned.minutes7d,
      daysSince: daysSince(unassigned.lastStudiedAt),
      latestRating: unassigned.latestRating,
    });
  }
  subjectRows.sort((a, b) => b.minutes7d - a.minutes7d || a.name.localeCompare(b.name));

  const subjectNames = Object.fromEntries(study.subjects.map((s) => [s.id, s.name]));
  const suggestion =
    rankStudyNext({ subjects: active, openTasks: study.openTasks, sessions: study.sessions, now, timezone })[0] ??
    null;
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
      today={toLocalDateKey(now, timezone)}
      initialNow={now}
      totalMinutes7d={totalMinutes7d}
      days={dailyTotals(study.sessions, now, timezone, 7)}
      subjectRows={subjectRows}
      sessions={study.sessions.filter((s) => now.getTime() - s.startedAt.getTime() <= RECENT_DAYS * DAY_MS)}
      subjectNames={subjectNames}
      taskTitles={study.taskTitles}
      activeSubjects={active.map(({ id, name }) => ({ id, name }))}
      topics={study.topics.filter((t) => !t.archivedAt).map(({ id, name, subjectId }) => ({ id, name, subjectId }))}
      suggestion={suggestion}
      running={running}
    />
  );
}
