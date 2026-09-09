import { requireAuth } from "@/lib/session";
import { getUserTasksQuery } from "@/actions/tasks";
import { TaskManager } from "@/components/tasks/task-manager";

export const metadata = {
  title: "Tasks",
  description: "Manage your personal tasks, priorities, and deadlines.",
};

export default async function TasksPage() {
  await requireAuth("/tasks");
  const tasks = await getUserTasksQuery();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Task Management
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create, track, and organize your tasks with priorities and deadlines.
          </p>
        </div>
      </div>

      <TaskManager initialTasks={tasks} />
    </main>
  );
}