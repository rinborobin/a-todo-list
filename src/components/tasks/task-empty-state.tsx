interface TaskEmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
  onCreateTask?: () => void;
}

export function TaskEmptyState({
  hasFilters,
  onClearFilters,
  onCreateTask,
}: TaskEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center bg-white/40 dark:bg-zinc-900/40">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-2xl mb-4">
        {hasFilters ? "🔍" : "📝"}
      </div>

      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {hasFilters ? "No matching tasks found" : "No tasks yet"}
      </h3>

      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
        {hasFilters
          ? "Try adjusting your filters or search terms to find what you are looking for."
          : "Get started by creating your first task. Organize your priorities and deadlines."}
      </p>

      <div className="mt-6 flex items-center gap-3">
        {hasFilters && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        )}

        {onCreateTask && (
          <button
            type="button"
            onClick={onCreateTask}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs sm:text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors cursor-pointer"
          >
            + New Task
          </button>
        )}
      </div>
    </div>
  );
}