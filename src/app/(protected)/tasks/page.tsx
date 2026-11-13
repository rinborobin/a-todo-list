import { getUserTasksQuery } from "@/actions/tasks";
import { getUserTimezoneQuery } from "@/actions/availability";
import { listMilestonesQuery, listSubjectsQuery } from "@/actions/study";
import { toTaskSubjectOptions } from "@/components/tasks/subject-options";
import { TaskManager } from "@/components/tasks/task-manager";

export const metadata = {
  title: "Tasks",
};

export default async function TasksPage() {
  const [tasks, timezone, subjects, milestones] = await Promise.all([
    getUserTasksQuery(),
    getUserTimezoneQuery(),
    listSubjectsQuery(),
    listMilestonesQuery(),
  ]);
  return (
    <TaskManager
      initialTasks={tasks}
      timezone={timezone}
      now={new Date()}
      subjects={toTaskSubjectOptions(subjects, milestones)}
    />
  );
}
