import { getTodayQuery } from "@/actions/planner";
import { getStudyContextQuery } from "@/actions/study";
import { TodayView } from "@/components/today/today-view";
import { rankStudyNext } from "@/lib/study/next";
import { toRailSubjects } from "@/components/planner/rail-subjects";

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
        subjects: activeSubjects.map(({ id, name }) => ({ id, name })),
        railSubjects: toRailSubjects(study.subjects),
        topics: study.topics
          .filter((t) => !t.archivedAt)
          .map(({ id, name, subjectId }) => ({ id, name, subjectId })),
      }}
    />
  );
}
