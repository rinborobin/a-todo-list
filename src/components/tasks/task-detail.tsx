import Link from "next/link";
import type { Task, TaskPriority, TaskStatus } from "@/db/schema";
import { describeDue, formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";

interface TaskDetailProps {
  task: Task;
  timezone: string;
  now: Date;
  subjectName?: string | null;
  milestoneName?: string | null;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

const PRIORITY: Record<TaskPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
const STATUS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

function formatFull(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function TaskDetail({ task, timezone, now, subjectName = null, milestoneName = null, onEdit, onDelete }: TaskDetailProps) {
  const isClosed = task.status === "COMPLETED" || task.status === "CANCELLED";
  const due = task.deadline && !isClosed ? describeDue(task.deadline, now, timezone) : null;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Subject", value: subjectName ?? <span className="text-faint">None</span> },
    ...(milestoneName ? [{ label: "Milestone", value: milestoneName }] : []),
    {
      label: "Due",
      value: task.deadline ? (
        <>
          {formatFull(task.deadline, timezone)}
          {due && due.tone !== "normal" && <span className="ml-2 font-medium text-accent">{due.label}</span>}
        </>
      ) : (
        <span className="text-faint">No deadline</span>
      ),
    },
    {
      label: "Time needed",
      value: task.estimatedMinutes ? (
        formatDuration(task.estimatedMinutes)
      ) : (
        <span className="text-faint">Not set, so it cannot be planned</span>
      ),
    },
    { label: "Priority", value: PRIORITY[task.priority] },
    { label: "Status", value: STATUS[task.status] },
  ];

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 sm:px-8 lg:px-10 lg:pt-10">
      <Link href="/tasks" className="-ml-1 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" />
        Tasks
      </Link>

      <h1
        className={`mt-4 font-serif text-[30px] leading-tight lg:text-[36px] ${
          isClosed ? "text-faint line-through decoration-faint" : ""
        }`}
      >
        {task.title}
      </h1>

      <dl className="mt-6 divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 py-3 text-[15px]">
            <dt className="w-28 shrink-0 text-muted">{row.label}</dt>
            <dd className="min-w-0">{row.value}</dd>
          </div>
        ))}
      </dl>

      {task.description && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{task.description}</p>
        </section>
      )}

      {(onEdit || onDelete) && (
        <div className="mt-8 flex gap-2">
          {onEdit && (
            <Button onClick={() => onEdit(task)}>
              <PencilIcon className="h-4 w-4" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" onClick={() => onDelete(task)} className="text-danger hover:text-danger">
              <TrashIcon className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
