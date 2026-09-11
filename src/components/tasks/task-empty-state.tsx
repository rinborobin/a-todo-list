import { InboxIcon, SearchIcon } from "@/components/ui/icons";

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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {hasFilters ? <SearchIcon className="h-6 w-6" /> : <InboxIcon className="h-6 w-6" />}
      </div>

      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {hasFilters ? "No matching tasks" : "No tasks yet"}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {hasFilters
          ? "Adjust your filters or search terms to find what you are looking for."
          : "Create your first task to start tracking priorities and deadlines."}
      </p>

      <div className="mt-5 flex items-center gap-3">
        {hasFilters && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            Clear Filters
          </button>
        )}

        {onCreateTask && (
          <button
            type="button"
            onClick={onCreateTask}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            New Task
          </button>
        )}
      </div>
    </div>
  );
}
