"use client";

import { useState } from "react";
import Link from "next/link";
import type { Task, TaskPriority, TaskStatus } from "@/db/schema";
import {
  CheckIcon,
  ClockIcon,
  CalendarIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
} from "@/components/ui/icons";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleStatus: (id: string, newStatus: TaskStatus) => void;
  isUpdating?: boolean;
}

const priorityIndicator: Record<TaskPriority, string> = {
  URGENT: "bg-rose-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-blue-500",
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
  const isCancelled = task.status === "CANCELLED";
  const deadlineInfo = formatDeadline(task.deadline);
  const formattedDuration = formatDuration(task.estimatedMinutes);

  const handleCheckboxClick = () => {
    const nextStatus: TaskStatus = isCompleted ? "TODO" : "COMPLETED";
    onToggleStatus(task.id, nextStatus);
  };

  return (
    <div
      className={`group rounded-lg border bg-white p-4 transition-colors dark:bg-zinc-900 ${
        isCompleted || isCancelled
          ? "border-zinc-200 opacity-70 dark:border-zinc-800"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleCheckboxClick}
          disabled={isUpdating}
          aria-label={isCompleted ? "Mark task as incomplete" : "Mark task as completed"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-zinc-300 bg-transparent hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
          } ${isUpdating ? "opacity-50" : ""}`}
        >
          {isCompleted && <CheckIcon className="h-3.5 w-3.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-400">
              <span
                className={`h-2 w-2 rounded-full ${priorityIndicator[task.priority]}`}
                aria-hidden="true"
              />
              {task.priority}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
            <span className="text-zinc-500 dark:text-zinc-400">{task.status.replace("_", " ")}</span>

            {formattedDuration && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
                <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {formattedDuration}
                </span>
              </>
            )}

            {deadlineInfo && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
                <span
                  className={`flex items-center gap-1 ${
                    deadlineInfo.isOverdue && !isCompleted
                      ? "font-medium text-rose-600 dark:text-rose-400"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {deadlineInfo.formatted}
                  {deadlineInfo.isOverdue && !isCompleted && <span className="hidden sm:inline">(Overdue)</span>}
                </span>
              </>
            )}
          </div>

          <h3
            className={`mt-1.5 text-base font-medium leading-snug break-words ${
              isCompleted || isCancelled
                ? "text-zinc-400 line-through dark:text-zinc-500"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            <Link href={`/tasks/${task.id}`} className="hover:underline focus:outline-none">
              {task.title}
            </Link>
          </h3>

          {task.description && (
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              <p className={isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}>{task.description}</p>
              {task.description.length > 120 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1">
          {!isCompleted && task.status !== "IN_PROGRESS" && (
            <button
              type="button"
              onClick={() => onToggleStatus(task.id, "IN_PROGRESS")}
              disabled={isUpdating}
              title="Mark as In Progress"
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
            >
              <PlayIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(task)}
            disabled={isUpdating}
            aria-label="Edit task"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
          >
            <PencilIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(task)}
            disabled={isUpdating}
            aria-label="Delete task"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
