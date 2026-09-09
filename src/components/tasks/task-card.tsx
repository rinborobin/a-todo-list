"use client";

import { useState } from "react";
import type { Task, TaskPriority, TaskStatus } from "@/db/schema";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleStatus: (id: string, newStatus: TaskStatus) => void;
  isUpdating?: boolean;
}

const priorityStyles: Record<TaskPriority, string> = {
  URGENT: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  LOW: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
};

const statusStyles: Record<TaskStatus, string> = {
  TODO: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  CANCELLED: "bg-zinc-100 text-zinc-500 line-through border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-500 dark:border-zinc-700",
};

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function formatDeadline(date: Date | string | null): { formatted: string; isOverdue: boolean } | null {
  if (!date) return null;
  const deadlineDate = new Date(date);
  if (isNaN(deadlineDate.getTime())) return null;

  const now = new Date();
  const isOverdue = deadlineDate < now;
  const isToday =
    deadlineDate.getDate() === now.getDate() &&
    deadlineDate.getMonth() === now.getMonth() &&
    deadlineDate.getFullYear() === now.getFullYear();

  const timeStr = deadlineDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = deadlineDate.toLocaleDateString([], { month: "short", day: "numeric" });

  let formatted = `${dateStr}, ${timeStr}`;
  if (isToday) {
    formatted = `Today, ${timeStr}`;
  }

  return { formatted, isOverdue };
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onToggleStatus,
  isUpdating = false,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCompleted = task.status === "COMPLETED";
  const deadlineInfo = formatDeadline(task.deadline);
  const formattedDuration = formatDuration(task.estimatedMinutes);

  const handleCheckboxClick = () => {
    const nextStatus: TaskStatus = isCompleted ? "TODO" : "COMPLETED";
    onToggleStatus(task.id, nextStatus);
  };

  return (
    <div
      className={`group relative rounded-xl border bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm transition-all hover:shadow-md ${
        isCompleted
          ? "border-zinc-200 dark:border-zinc-800/60 opacity-75"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Quick Complete Button / Checkbox */}
        <button
          type="button"
          onClick={handleCheckboxClick}
          disabled={isUpdating}
          aria-label={isCompleted ? "Mark task as incomplete" : "Mark task as completed"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-zinc-300 dark:border-zinc-700 bg-transparent hover:border-zinc-400 dark:hover:border-zinc-500"
          } ${isUpdating ? "opacity-50 cursor-wait" : ""}`}
        >
          {isCompleted && (
            <svg className="h-3.5 w-3.5 stroke-current stroke-[3]" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {/* Priority Badge */}
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                priorityStyles[task.priority]
              }`}
            >
              {task.priority}
            </span>

            {/* Status Badge */}
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                statusStyles[task.status]
              }`}
            >
              {task.status.replace("_", " ")}
            </span>

            {/* Duration Badge */}
            {formattedDuration && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>⏱</span>
                <span>{formattedDuration}</span>
              </span>
            )}

            {/* Deadline */}
            {deadlineInfo && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  deadlineInfo.isOverdue && !isCompleted
                    ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900"
                    : "text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                <span>📅</span>
                <span>{deadlineInfo.formatted}</span>
                {deadlineInfo.isOverdue && !isCompleted && <span>(Overdue)</span>}
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            className={`text-base font-semibold leading-snug break-words ${
              isCompleted
                ? "text-zinc-400 dark:text-zinc-500 line-through"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {task.title}
          </h3>

          {/* Description */}
          {task.description && (
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              <p className={isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}>
                {task.description}
              </p>
              {task.description.length > 120 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 underline cursor-pointer"
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Quick status cycle button */}
          {!isCompleted && task.status !== "IN_PROGRESS" && (
            <button
              type="button"
              onClick={() => onToggleStatus(task.id, "IN_PROGRESS")}
              disabled={isUpdating}
              title="Mark as In Progress"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer text-xs"
            >
              ▶
            </button>
          )}

          {/* Edit Button */}
          <button
            type="button"
            onClick={() => onEdit(task)}
            disabled={isUpdating}
            aria-label="Edit task"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer text-xs"
          >
            ✏️
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => onDelete(task)}
            disabled={isUpdating}
            aria-label="Delete task"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer text-xs"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}