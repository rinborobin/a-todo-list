import { getUserTasksQuery } from "@/actions/tasks";
import { getUserTimezoneQuery } from "@/actions/availability";
import { listSubjectsQuery } from "@/actions/study";
import { TaskManager } from "@/components/tasks/task-manager";

export const metadata = {
  title: "Tasks",
};

export default async function TasksPage() {
  const [tasks, timezone, subjects] = await Promise.all([
    getUserTasksQuery(),
    getUserTimezoneQuery(),
    listSubjectsQuery(),
  ]);
  return (
    <TaskManager
      initialTasks={tasks}
      timezone={timezone}
      now={new Date()}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name, archived: s.archivedAt !== null }))}
    />
  );
}
