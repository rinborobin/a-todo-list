import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { getUserTaskStatsQuery, getUserTasksQuery } from "@/actions/tasks";
import { DocumentTextIcon } from "@/components/ui/icons";

export const metadata = {
  title: "Dashboard",
  description: "AI Daily Planner dashboard",
};

export default async function DashboardPage() {
  const session = await requireAuth("/dashboard");
  const user = session.user;
  const stats = await getUserTaskStatsQuery();
  const recentTasks = await getUserTasksQuery({ sortBy: "createdAt", sortOrder: "desc" });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {user.name ? `${user.name}'s plans` : "Your plans"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track tasks and generate daily schedules.
          </p>
        </div>

        <Link
          href="/tasks"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shrink-0 transition-colors"
        >
          <DocumentTextIcon className="h-4 w-4" />
          <span>Manage Tasks ({stats.total})</span>
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-4">
        <div className="bg-white p-4 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Tasks</p>
          <p className="mt-0.5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{stats.total}</p>
        </div>
        <div className="bg-white p-4 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">To Do</p>
          <p className="mt-0.5 text-2xl font-semibold text-blue-600 dark:text-blue-400">{stats.todo}</p>
        </div>
        <div className="bg-white p-4 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">In Progress</p>
          <p className="mt-0.5 text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {stats.inProgress}
          </p>
        </div>
        <div className="bg-white p-4 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Completed</p>
          <p className="mt-0.5 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent Tasks</h2>
            <Link
              href="/tasks"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              View all
            </Link>
          </div>

          {recentTasks.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No tasks created yet.</p>
              <Link
                href="/tasks"
                className="mt-3 inline-block rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Create your first task
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="flex items-center justify-between rounded-md border border-zinc-100 p-2.5 transition-colors hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                  >
                    <div className="flex min-w-0 items-center gap-2 pr-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          t.status === "COMPLETED"
                            ? "bg-emerald-500"
                            : t.priority === "URGENT"
                              ? "bg-rose-500"
                              : t.priority === "HIGH"
                                ? "bg-orange-500"
                                : t.priority === "MEDIUM"
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                        }`}
                      />
                      <span
                        className={`truncate text-sm ${
                          t.status === "COMPLETED"
                            ? "text-zinc-400 line-through"
                            : "text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {t.title}
                      </span>
                    </div>

                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {t.priority}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {stats.urgent > 0 ? (
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {stats.urgent} urgent / high priority task{stats.urgent > 1 ? "s" : ""}
                </span>
              ) : (
                "No urgent tasks pending"
              )}
            </span>
            <Link
              href="/tasks"
              className="text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              Open task board
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Account</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Signed in as {user.email}
          </p>

          <div className="mt-6 rounded-md bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
            <strong>Data isolation:</strong> Tasks and plans are scoped to your account only.
          </div>
        </div>
      </div>
    </main>
  );
}
