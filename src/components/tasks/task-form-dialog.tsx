"use client";

import { useState } from "react";
import type { Task, TaskPriority, TaskStatus } from "@/db/schema";
import { CloseIcon } from "@/components/ui/icons";
import { createTaskSchema, updateTaskSchema } from "@/lib/validations/task";

interface TaskFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string | null;
    priority: TaskPriority;
    status?: TaskStatus;
    estimatedMinutes?: number | null;
    deadline?: string | null;
  }) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[] | undefined> }>;
  initialTask?: Task | null;
}

const priorities: { label: string; value: TaskPriority; color: string }[] = [
  { label: "Low", value: "LOW", color: "text-blue-600 dark:text-blue-400" },
  { label: "Medium", value: "MEDIUM", color: "text-amber-600 dark:text-amber-400" },
  { label: "High", value: "HIGH", color: "text-orange-600 dark:text-orange-400" },
  { label: "Urgent", value: "URGENT", color: "text-rose-600 dark:text-rose-400" },
];

const statuses: { label: string; value: TaskStatus }[] = [
  { label: "To Do", value: "TODO" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function toDatetimeLocalString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function TaskFormDialog({
  isOpen,
  onClose,
  onSubmit,
  initialTask,
}: TaskFormDialogProps) {
  const isEditing = !!initialTask;

  const [title, setTitle] = useState(initialTask?.title || "");
  const [description, setDescription] = useState(initialTask?.description || "");
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority || "MEDIUM");
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status || "TODO");
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    initialTask?.estimatedMinutes ? String(initialTask.estimatedMinutes) : ""
  );
  const [deadline, setDeadline] = useState<string>(
    toDatetimeLocalString(initialTask?.deadline)
  );

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const payload = {
      title,
      description: description.trim() === "" ? null : description,
      priority,
      status: isEditing ? status : undefined,
      estimatedMinutes: estimatedMinutes.trim() === "" ? null : Number(estimatedMinutes),
      deadline: deadline.trim() === "" ? null : new Date(deadline).toISOString(),
    };

    // Client-side validation
    const schema = isEditing ? updateTaskSchema : createTaskSchema;
    const clientValidation = schema.safeParse(payload);
    if (!clientValidation.success) {
      const flattened = clientValidation.error.flatten();
      setFieldErrors(flattened.fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await onSubmit(payload);
      if (!res.success) {
        setError(res.error || "An error occurred");
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setIsSubmitting(false);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 my-8"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 id="task-dialog-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {isEditing ? "Edit Task" : "Create New Task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="task-title"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Finish quarterly project proposal"
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.title[0]}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="task-description"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Description (optional)
            </label>
            <textarea
              id="task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key context, links, or notes..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 resize-y"
            />
            {fieldErrors.description && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.description[0]}
              </p>
            )}
          </div>

          {/* Priority selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorities.map((p) => {
                const isSelected = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`rounded-lg border py-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.priority && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.priority[0]}
              </p>
            )}
          </div>

          {/* Status selector (editing only) */}
          {isEditing && (
            <div>
              <label
                htmlFor="task-status"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Status
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer"
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Estimated Duration & Deadline Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Estimated Duration */}
            <div>
              <label
                htmlFor="task-duration"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Duration (minutes)
              </label>
              <input
                id="task-duration"
                type="number"
                min={1}
                max={1440}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="e.g. 45"
                className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Max 1440 mins (24 hrs)
              </p>
              {fieldErrors.estimatedMinutes && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.estimatedMinutes[0]}
                </p>
              )}
            </div>

            {/* Deadline */}
            <div>
              <label
                htmlFor="task-deadline"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Deadline
              </label>
              <input
                id="task-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              {fieldErrors.deadline && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.deadline[0]}
                </p>
              )}
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-60"
            >
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                ? "Save Changes"
                : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}