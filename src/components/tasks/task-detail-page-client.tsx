"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@/db/schema";
import { TaskDetail } from "./task-detail";
import { TaskFormDialog } from "./task-form-dialog";
import { DeleteTaskDialog } from "./delete-task-dialog";
import { updateTaskAction, deleteTaskAction } from "@/actions/tasks";

interface TaskDetailPageClientProps {
  task: Task;
  timezone: string;
  now: Date;
}

export function TaskDetailPageClient({ task, timezone, now }: TaskDetailPageClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleEdit = async (data: {
    title: string;
    description?: string | null;
    priority: Task["priority"];
    status?: Task["status"];
    estimatedMinutes?: number | null;
    deadline?: string | null;
  }) => {
    const res = await updateTaskAction(task.id, {
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

    setIsEditing(false);
    router.refresh();
    return { success: true };
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    setIsDeleteSubmitting(true);
    const res = await deleteTaskAction(id);
    setIsDeleteSubmitting(false);
    if (res.success) {
      router.push("/tasks");
    } else {
      setActionError(res.error || "Failed to delete task");
    }
  };

  return (
    <>
      {actionError && (
        <p role="alert" className="mx-auto mt-4 max-w-2xl px-5 text-sm text-danger sm:px-8 lg:px-10">
          {actionError}
        </p>
      )}

      <TaskDetail
        task={task}
        timezone={timezone}
        now={now}
        onEdit={() => setIsEditing(true)}
        onDelete={() => setIsDeleting(true)}
      />

      {isEditing && (
        <TaskFormDialog
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onSubmit={handleEdit}
          initialTask={task}
        />
      )}

      <DeleteTaskDialog
        isOpen={isDeleting}
        task={task}
        onClose={() => setIsDeleting(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleteSubmitting}
      />
    </>
  );
}
