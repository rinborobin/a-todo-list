import { getUserTasksQuery } from "@/actions/tasks";
import { getUserTimezoneQuery } from "@/actions/availability";
import { TaskManager } from "@/components/tasks/task-manager";

export const metadata = {
  title: "Tasks",
};

export default async function TasksPage() {
  const [tasks, timezone] = await Promise.all([getUserTasksQuery(), getUserTimezoneQuery()]);
  return <TaskManager initialTasks={tasks} timezone={timezone} now={new Date()} />;
}
