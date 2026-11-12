"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Task, TaskPriority, TaskStatus } from "@/db/schema";
import { createTaskAction, updateTaskAction, deleteTaskAction, toggleTaskStatusAction } from "@/actions/tasks";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/scheduling/timezone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { TaskRow } from "./task-row";
import { TaskFormDialog } from "./task-form-dialog";
import { DeleteTaskDialog } from "./delete-task-dialog";

interface TaskManagerProps {
  initialTasks: Task[];
  timezone: string;
  now: Date;
}

type View = "open" | "done" | "all";

const PRIORITY_SCORE: Record<TaskPriority, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function byDeadlineThenPriority(a: Task, b: Task) {
  const ad = a.deadline?.getTime() ?? Infinity;
  const bd = b.deadline?.getTime() ?? Infinity;
  if (ad !== bd) return ad - bd;
  return PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority];
}

function isOpen(task: Task) {
  return task.status === "TODO" || task.status === "IN_PROGRESS";
}

export function TaskManager({ initialTasks, timezone, now }: TaskManagerProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("open");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = tasks.filter(
      (t) => !query || t.title.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)
    );

    const weekEnd = addDaysToDateKey(toLocalDateKey(now, timezone), 6);
    const open = matches.filter(isOpen).sort(byDeadlineThenPriority);
    const closed = matches
      .filter((t) => !isOpen(t))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const result: { label: string; tasks: Task[] }[] = [];
    if (view !== "done") {
      result.push(
        { label: "Overdue", tasks: open.filter((t) => t.deadline && t.deadline < now) },
        {
          label: "Next 7 days",
          tasks: open.filter((t) => t.deadline && t.deadline >= now && toLocalDateKey(t.deadline, timezone) <= weekEnd),
        },
        { label: "Later", tasks: open.filter((t) => t.deadline && toLocalDateKey(t.deadline, timezone) > weekEnd) },
        { label: "No deadline", tasks: open.filter((t) => !t.deadline) }
      );
    }
    if (view !== "open") result.push({ label: "Done", tasks: closed });
    return result.filter((group) => group.tasks.length > 0);
  }, [tasks, search, view, now, timezone]);

  const openCount = tasks.filter(isOpen).length;

  const openCreate = () => {
    setEditingTask(null);
    setIsFormOpen(true);
  };

  const handleSaveTask = async (data: {
    title: string;
    description?: string | null;
    priority: TaskPriority;
    status?: TaskStatus;
    estimatedMinutes?: number | null;
    deadline?: string | null;
  }) => {
    setActionError(null);
    const res = editingTask
      ? await updateTaskAction(editingTask.id, {
          title: data.title,
          description: data.description ?? null,
          priority: data.priority,
          status: data.status,
          estimatedMinutes: data.estimatedMinutes ?? null,
          deadline: data.deadline ?? null,
        })
      : await createTaskAction({
          title: data.title,
          description: data.description ?? null,
          priority: data.priority,
          status: "TODO",
          estimatedMinutes: data.estimatedMinutes ?? null,
          deadline: data.deadline ?? null,
        });

    if (!res.success) {
      return { success: false, error: res.error, fieldErrors: res.fieldErrors };
    }

    setTasks((prev) =>
      editingTask ? prev.map((t) => (t.id === editingTask.id ? res.data : t)) : [res.data, ...prev]
    );
    router.refresh();
    return { success: true };
  };

  const handleToggle = (task: Task) => {
    const newStatus: TaskStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    setUpdatingTaskId(task.id);
    setActionError(null);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, updatedAt: new Date() } : t)));

    startTransition(async () => {
      const res = await toggleTaskStatusAction(task.id, newStatus);
      if (!res.success) {
        setActionError(res.error || "Could not update the task");
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      } else {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? res.data : t)));
      }
      setUpdatingTaskId(null);
    });
  };

  const handleConfirmDelete = async (id: string) => {
    setIsDeleting(true);
    setActionError(null);
    const res = await deleteTaskAction(id);
    setIsDeleting(false);
    if (!res.success) {
      setActionError(res.error || "Could not delete the task");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeletingTask(null);
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-3xl px-5 pt-6 sm:px-8 lg:px-10 lg:pt-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{openCount} open</p>
          <h1 className="font-serif text-[34px] leading-tight lg:text-[40px]">Tasks</h1>
        </div>
        <Button variant="primary" onClick={openCreate} className="mb-1">
          <PlusIcon className="h-4 w-4" />
          New task
        </Button>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <Input
            id="task-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="pl-10"
          />
        </div>
        <div role="group" aria-label="Show" className="grid grid-cols-3 gap-1 rounded-xl bg-line/50 p-1 sm:w-64">
          {(["open", "done", "all"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`h-9 rounded-lg text-[13px] capitalize transition-colors ${
                view === option ? "bg-sheet font-medium text-ink shadow-[0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {actionError && <p className="mt-4 text-sm text-danger">{actionError}</p>}

      {groups.length === 0 ? (
        <div className="mt-10 border-l border-line-strong py-2 pl-6">
          <p className="font-serif text-lg text-ink-soft">
            {search.trim()
              ? "Nothing matches that search."
              : view === "done"
                ? "Nothing finished yet."
                : "No open tasks. Add one when something comes up."}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2
                className={`mb-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                  group.label === "Overdue" ? "text-accent" : "text-muted"
                }`}
              >
                {group.label} · {group.tasks.length}
              </h2>
              <ul className="divide-y divide-line">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    now={now}
                    timezone={timezone}
                    busy={updatingTaskId === task.id}
                    onToggle={handleToggle}
                    onEdit={(t) => {
                      setEditingTask(t);
                      setIsFormOpen(true);
                    }}
                    onDelete={setDeletingTask}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {isFormOpen && (
        <TaskFormDialog
          key={editingTask?.id || "new"}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTask(null);
          }}
          onSubmit={handleSaveTask}
          initialTask={editingTask}
        />
      )}

      <DeleteTaskDialog
        isOpen={deletingTask !== null}
        task={deletingTask}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </main>
  );
}
