"use client";

import Link from "next/link";
import type { Task } from "@/db/schema";
import { describeDue, formatDuration } from "@/lib/format";
import { CheckIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";

interface TaskRowProps {
  task: Task;
  subjectName?: string;
  now: Date;
  timezone: string;
  busy?: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskRow({ task, subjectName, now, timezone, busy, onToggle, onEdit, onDelete }: TaskRowProps) {
  const isDone = task.status === "COMPLETED";
  const isCancelled = task.status === "CANCELLED";
  const due = task.deadline && !isDone && !isCancelled ? describeDue(task.deadline, now, timezone) : null;

  const meta: React.ReactNode[] = [];
  if (subjectName) meta.push(<span key="subject" className="font-medium text-ink-soft">{subjectName}</span>);
  if (due) {
    meta.push(
      <span key="due" className={due.tone === "normal" ? "" : "font-medium text-accent"}>
        {due.tone === "overdue" ? due.label : `Due ${due.label.replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}`}
      </span>
    );
  }
  if (task.estimatedMinutes) meta.push(<span key="dur">{formatDuration(task.estimatedMinutes)}</span>);
  else if (!isDone && !isCancelled) meta.push(<span key="dur">No time estimate</span>);
  if (task.priority === "URGENT" || task.priority === "HIGH") {
    meta.push(
      <span key="pri" className={task.priority === "URGENT" ? "text-accent" : "text-ink-soft"}>
        {task.priority === "URGENT" ? "Urgent" : "High"}
      </span>
    );
  }
  if (task.status === "IN_PROGRESS") meta.push(<span key="st">In progress</span>);
  if (isCancelled) meta.push(<span key="st">Cancelled</span>);

  return (
    <li className="group flex items-start gap-1">
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={busy || isCancelled}
        aria-pressed={isDone}
        aria-label={isDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] transition-colors ${
            isDone ? "border-ink bg-ink text-paper" : "border-faint hover:border-ink"
          }`}
        >
          {isDone && <CheckIcon className="h-3 w-3" />}
        </span>
      </button>

      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 py-2.5">
        <span
          className={`block truncate text-[15px] font-medium ${
            isDone || isCancelled ? "text-faint line-through decoration-faint" : ""
          }`}
        >
          {task.title}
        </span>
        {meta.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-muted">
            {meta.flatMap((item, i) => (i === 0 ? [item] : [<span key={`sep-${i}`} aria-hidden="true">·</span>, item]))}
          </span>
        )}
      </Link>

      <div className="hidden shrink-0 items-center gap-0.5 pt-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 lg:flex">
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label={`Edit "${task.title}"`}
          className="rounded-lg p-2 text-muted hover:bg-line/60 hover:text-ink"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`Delete "${task.title}"`}
          className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
