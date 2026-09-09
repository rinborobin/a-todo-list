"use client";

import type { Task } from "@/db/schema";

interface DeleteTaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteTaskDialog({
  task,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteTaskDialogProps) {
  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            ⚠️
          </div>
          <div>
            <h2 id="delete-dialog-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Delete Task
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Are you sure you want to permanently delete{" "}
          <strong className="text-zinc-900 dark:text-zinc-100">&ldquo;{task.title}&rdquo;</strong>?
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(task.id)}
            disabled={isDeleting}
            className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? "Deleting..." : "Delete Task"}
          </button>
        </div>
      </div>
    </div>
  );
}