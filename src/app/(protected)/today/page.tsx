import { getTodayQuery } from "@/actions/planner";
import { getStudyContextQuery } from "@/actions/study";
import { TodayView } from "@/components/today/today-view";
import { nextTopicsFirst, rankStudyNext } from "@/lib/study/next";
import { toLocalDateKey } from "@/lib/scheduling/timezone";
import { toRailSubjects } from "@/components/planner/rail-subjects";
import { toPickerSubjects } from "@/lib/study/picker";

export const metadata = {
  title: "Today",
};

export default async function TodayPage() {
  const [data, study] = await Promise.all([getTodayQuery(), getStudyContextQuery()]);
  const now = new Date();

  const activeSubjects = study.subjects.filter((s) => !s.archivedAt);
  const subjectName = new Map(study.subjects.map((s) => [s.id, s.name]));
  const taskTitle = new Map(study.openTasks.map((t) => [t.id, t.title]));
  const suggestion =
    rankStudyNext({
      subjects: activeSubjects,
      topics: study.topics,
      milestones: study.milestones,
      finishedTasks: study.finishedTasks,
      openTasks: study.openTasks,
      sessions: study.sessions,
      now,
      timezone: study.timezone,
    })[0] ?? null;

  const running = study.running
    ? {
        id: study.running.id,
        startedAt: study.running.startedAt,
        subjectName: study.running.subjectId ? (subjectName.get(study.running.subjectId) ?? null) : null,
        taskTitle: study.running.taskId ? (taskTitle.get(study.running.taskId) ?? null) : null,
      }
    : null;

  return (
    <TodayView
      data={data}
      initialNow={now}
      study={{
        suggestion,
        running,
        subjects: toPickerSubjects({
          subjects: activeSubjects,
          topics: study.topics,
          milestones: study.milestones,
          openTasks: study.openTasks,
          sessions: study.sessions,
          today: toLocalDateKey(now, study.timezone),
        }),
        railSubjects: toRailSubjects(study.subjects),
        topics: nextTopicsFirst(
          study.topics.filter((t) => !t.archivedAt),
          study.sessions,
          toLocalDateKey(now, study.timezone)
        ).map(({ id, name, subjectId }) => ({ id, name, subjectId })),
      }}
    />
  );
}
