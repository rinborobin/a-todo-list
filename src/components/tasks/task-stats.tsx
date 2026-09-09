interface TaskStatsProps {
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    completed: number;
    urgent: number;
  };
}

export function TaskStats({ stats }: TaskStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4 mb-6">
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

      <div className="col-span-2 sm:col-span-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          High / Urgent
        </p>
        <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.urgent}</p>
      </div>
    </div>
  );
}