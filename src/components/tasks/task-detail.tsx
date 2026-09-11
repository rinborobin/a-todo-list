"use client";

import Link from "next/link";
import type { Task, TaskPriority } from "@/db/schema";
import {
  ClockIcon,
  CalendarIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
} from "@/components/ui/icons";

interface TaskDetailProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

const priorityText: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const priorityIndicator: Record<TaskPriority, string> = {
  URGENT: "bg-rose-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-blue-500",
};

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function formatDeadline(date: Date | string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskDetail({ task, onEdit, onDelete }: TaskDetailProps) {
  const formattedDuration = formatDuration(task.estimatedMinutes);
  const formattedDeadline = formatDeadline(task.deadline);
  const isCompleted = task.status === "COMPLETED";
  const isCancelled = task.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to tasks
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-400">
                <span
                  className={`h-2 w-2 rounded-full ${priorityIndicator[task.priority]}`}
                  aria-hidden="true"
                />
                {priorityText[task.priority]} priority
              </span>
              <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
              <span className="text-zinc-500 dark:text-zinc-400">{task.status.replace("_", " ")}</span>
            </div>

            <h1
              className={`mt-2 text-2xl font-semibold tracking-tight ${
                isCompleted || isCancelled
                  ? "text-zinc-400 line-through dark:text-zinc-500"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {task.title}
            </h1>
          </div>

          {(onEdit || onDelete) && (
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(task)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {task.description && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
              {task.description}
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Estimated Duration</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              {formattedDuration ? (
                <>
                  <ClockIcon className="h-4 w-4 text-zinc-400" />
                  {formattedDuration}
                </>
              ) : (
                "Not set"
              )}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Deadline</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              {formattedDeadline ? (
                <>
                  <CalendarIcon className="h-4 w-4 text-zinc-400" />
                  {formattedDeadline}
                </>
              ) : (
                "No deadline"
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Created {new Date(task.createdAt).toLocaleDateString()} · Updated{" "}
            {new Date(task.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
