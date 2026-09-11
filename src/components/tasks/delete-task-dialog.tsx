"use client";

import type { Task } from "@/db/schema";
import { AlertTriangleIcon } from "@/components/ui/icons";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <AlertTriangleIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Delete Task
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">This action cannot be undone.</p>
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
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(task.id)}
            disabled={isDeleting}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {isDeleting ? "Deleting..." : "Delete Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
