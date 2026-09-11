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
    <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-5">
      <div className="bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Total</p>
        <p className="mt-0.5 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{stats.total}</p>
      </div>
      <div className="bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">To Do</p>
        <p className="mt-0.5 text-xl font-semibold text-blue-600 dark:text-blue-400">{stats.todo}</p>
      </div>
      <div className="bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">In Progress</p>
        <p className="mt-0.5 text-xl font-semibold text-amber-600 dark:text-amber-400">{stats.inProgress}</p>
      </div>
      <div className="bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Completed</p>
        <p className="mt-0.5 text-xl font-semibold text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
      </div>
      <div className="col-span-3 bg-white p-3 dark:bg-zinc-900 sm:col-span-1">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">High / Urgent</p>
        <p className="mt-0.5 text-xl font-semibold text-rose-600 dark:text-rose-400">{stats.urgent}</p>
      </div>
    </div>
  );
}
