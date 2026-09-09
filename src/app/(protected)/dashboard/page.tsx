import { requireAuth } from "@/lib/session";

export const metadata = {
  title: "Dashboard",
  description: "AI Daily Planner dashboard",
};

export default async function DashboardPage() {
  const session = await requireAuth("/dashboard");
  const user = session.user;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, {user.name || "Planner"}!
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your personal AI planning workspace is ready.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
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

        {/* Next Features Status Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Upcoming Features
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Features unlocked in upcoming milestones
            </p>

            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span><strong>Milestone 3:</strong> Task Management (CRUD, priorities, deadlines)</span>
              </li>
              <li className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span><strong>Milestone 4:</strong> Availability Windows & Timezones</span>
              </li>
              <li className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span><strong>Milestone 5:</strong> AI Daily Planner & Replanning</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
            🔒 <strong>Data Isolation Verified:</strong> Your session is authenticated. Subsequent milestones will automatically isolate all tasks and plans using your user ID.
          </div>
        </div>
      </div>
    </main>
  );
}