import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { getUserTaskStatsQuery, getUserTasksQuery } from "@/actions/tasks";

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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back, {user.name || "Planner"}!
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Your personal AI planning workspace is ready.
          </p>
        </div>

        <Link
          href="/tasks"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shrink-0"
        >
          <span>📋</span>
          <span>Manage Tasks ({stats.total})</span>
        </Link>
      </div>

      {/* Task Summary Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-8">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Total Tasks
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{stats.total}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            To Do
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.todo}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            In Progress
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.inProgress}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Completed
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Tasks Widget */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Recent Tasks
              </h2>
              <Link
                href="/tasks"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
              >
                View all →
              </Link>
            </div>

            {recentTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No tasks created yet.</p>
                <Link
                  href="/tasks"
                  className="mt-3 inline-block rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Create your first task
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {recentTasks.slice(0, 4).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800/60 p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
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
                        className={`text-sm truncate ${
                          t.status === "COMPLETED"
                            ? "line-through text-zinc-400"
                            : "text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {t.title}
                      </span>
                    </div>

                    <span className="text-[11px] text-zinc-500 shrink-0 uppercase tracking-wider font-semibold">
                      {t.priority}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {stats.urgent > 0 ? (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  ⚠️ {stats.urgent} urgent / high priority task{stats.urgent > 1 ? "s" : ""}
                </span>
              ) : (
                "No urgent tasks pending"
              )}
            </span>
            <Link
              href="/tasks"
              className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline"
            >
              Open task board →
            </Link>
          </div>
        </div>

        {/* Account Profile Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Account Profile
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Verified server-side session from database
            </p>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Full Name
                </dt>
                <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                  {user.name || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Email Address
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-zinc-900 dark:text-zinc-100">
                  {user.email}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  User ID (Internal)
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-zinc-600 dark:text-zinc-400 break-all">
                  {user.id}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Session Expiration
                </dt>
                <dd className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {new Date(session.session.expiresAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
            🔒 <strong>Data Isolation Verified:</strong> All tasks and future daily plans are strictly scoped to this user ID.
          </div>
        </div>
      </div>
    </main>
  );
}