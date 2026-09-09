"use client";

import { useMemo, useState, useTransition } from "react";
import type { Task, TaskPriority, TaskStatus } from "@/db/schema";
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
  toggleTaskStatusAction,
} from "@/actions/tasks";
import { TaskStats } from "./task-stats";
import { TaskFilters } from "./task-filters";
import { TaskCard } from "./task-card";
import { TaskEmptyState } from "./task-empty-state";
import { TaskFormDialog } from "./task-form-dialog";
import { DeleteTaskDialog } from "./delete-task-dialog";

interface TaskManagerProps {
  initialTasks: Task[];
}

export function TaskManager({ initialTasks }: TaskManagerProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isPending, startTransition] = useTransition();

  // Filter and Sort states
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<TaskPriority | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"createdAt" | "deadline" | "priority">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Updating task IDs for optimistic micro-states
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Calculated stats
  const stats = useMemo(() => {
    return {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === "TODO").length,
      inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      completed: tasks.filter((t) => t.status === "COMPLETED").length,
      urgent: tasks.filter(
        (t) =>
          (t.priority === "URGENT" || t.priority === "HIGH") &&
          t.status !== "COMPLETED" &&
          t.status !== "CANCELLED"
      ).length,
    };
  }, [tasks]);

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Status filter
        if (status !== "ALL" && t.status !== status) return false;
        // Priority filter
        if (priority !== "ALL" && t.priority !== priority) return false;
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = t.description ? t.description.toLowerCase().includes(q) : false;
          if (!matchTitle && !matchDesc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === "deadline") {
          const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          diff = aTime - bTime;
        } else if (sortBy === "priority") {
          const priorityScore: Record<TaskPriority, number> = {
            URGENT: 4,
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1,
          };
          diff = priorityScore[b.priority] - priorityScore[a.priority];
        } else {
          // createdAt
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          diff = bTime - aTime;
        }
        return sortOrder === "asc" ? -diff : diff;
      });
  }, [tasks, status, priority, search, sortBy, sortOrder]);

  const hasActiveFilters = search.trim() !== "" || status !== "ALL" || priority !== "ALL";

  const handleClearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setPriority("ALL");
  };

  // Create or Update task handler
  const handleSaveTask = async (data: {
    title: string;
    description?: string | null;
    priority: TaskPriority;
    status?: TaskStatus;
    estimatedMinutes?: number | null;
    deadline?: string | null;
  }) => {
    setActionError(null);
    if (editingTask) {
      // Update
      const res = await updateTaskAction(editingTask.id, {
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        status: data.status,
        estimatedMinutes: data.estimatedMinutes ?? null,
        deadline: data.deadline ?? null,
      });

      if (!res.success) {
        return {
          success: false,
          error: res.error || "Failed to update task",
          fieldErrors: res.fieldErrors,
        };
      }

      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? res.data : t)));
      return { success: true };
    } else {
      // Create
      const res = await createTaskAction({
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        status: data.status || "TODO",
        estimatedMinutes: data.estimatedMinutes ?? null,
        deadline: data.deadline ?? null,
      });

      if (!res.success) {
        return {
          success: false,
          error: res.error || "Failed to create task",
          fieldErrors: res.fieldErrors,
        };
      }

      setTasks((prev) => [res.data, ...prev]);
      return { success: true };
    }
  };

  // Toggle Status handler
  const handleToggleStatus = async (id: string, newStatus: TaskStatus) => {
    setUpdatingTaskId(id);
    setActionError(null);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus, updatedAt: new Date() } : t))
    );

    startTransition(async () => {
      const res = await toggleTaskStatusAction(id, newStatus);
      if (!res.success) {
        setActionError(res.error || "Failed to update task status");
        // Rollback
        setTasks(initialTasks);
      } else if (res.data) {
        setTasks((prev) => prev.map((t) => (t.id === id ? res.data! : t)));
      }
      setUpdatingTaskId(null);
    });
  };

  // Delete task confirmation handler
  const handleConfirmDelete = async (id: string) => {
    setIsDeleting(true);
    setActionError(null);
    try {
      const res = await deleteTaskAction(id);
      if (res.success) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setIsDeleteOpen(false);
        setDeletingTask(null);
      } else {
        setActionError(res.error || "Failed to delete task");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* Global Action Error Alert */}
      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 flex items-center justify-between"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs text-red-500 hover:text-red-700 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <TaskStats stats={stats} />

      {/* Filters, Search, and New Task Trigger */}
      <TaskFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        priority={priority}
        onPriorityChange={setPriority}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onOpenCreateDialog={() => {
          setEditingTask(null);
          setIsFormOpen(true);
        }}
      />

      {/* Task List or Empty State */}
      {filteredTasks.length === 0 ? (
        <TaskEmptyState
          hasFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onCreateTask={() => {
            setEditingTask(null);
            setIsFormOpen(true);
          }}
        />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((taskItem) => (
            <TaskCard
              key={taskItem.id}
              task={taskItem}
              onEdit={(t) => {
                setEditingTask(t);
                setIsFormOpen(true);
              }}
              onDelete={(t) => {
                setDeletingTask(t);
                setIsDeleteOpen(true);
              }}
              onToggleStatus={handleToggleStatus}
              isUpdating={updatingTaskId === taskItem.id || isPending}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
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

      {/* Delete Confirmation Dialog */}
      <DeleteTaskDialog
        isOpen={isDeleteOpen}
        task={deletingTask}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingTask(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}