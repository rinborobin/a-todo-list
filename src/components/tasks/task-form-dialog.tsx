"use client";

import { useState } from "react";
import type { Task, TaskPriority, TaskStatus } from "@/db/schema";
import { createTaskSchema, updateTaskSchema } from "@/lib/validations/task";
import { createSubjectAction } from "@/actions/study";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorNote, Field, Input, Select, Textarea } from "@/components/ui/field";

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
    subjectId?: string | null;
  }) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[] | undefined> }>;
  initialTask?: Task | null;
  subjects?: { id: string; name: string }[];
}

const priorities: { label: string; value: TaskPriority }[] = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];

const statuses: { label: string; value: TaskStatus }[] = [
  { label: "To do", value: "TODO" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Done", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const durationPresets = [30, 60, 90, 120];

function toDatetimeLocalString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function presetLabel(minutes: number) {
  return minutes < 60 ? `${minutes}m` : minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function TaskFormDialog({ isOpen, onClose, onSubmit, initialTask, subjects = [] }: TaskFormDialogProps) {
  const isEditing = !!initialTask;

  const [title, setTitle] = useState(initialTask?.title || "");
  const [description, setDescription] = useState(initialTask?.description || "");
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority || "MEDIUM");
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status || "TODO");
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    initialTask?.estimatedMinutes ? String(initialTask.estimatedMinutes) : isEditing ? "" : "60"
  );
  const [deadline, setDeadline] = useState<string>(toDatetimeLocalString(initialTask?.deadline));
  const [subjectOptions, setSubjectOptions] = useState(subjects);
  const [subjectId, setSubjectId] = useState<string>(initialTask?.subjectId ?? "");
  const [newSubject, setNewSubject] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const addSubject = async () => {
    if (!newSubject?.trim()) return;
    setSubjectError(null);
    const res = await createSubjectAction({ name: newSubject });
    if (!res.success) {
      setSubjectError(res.error);
      return;
    }
    setSubjectOptions((prev) => [...prev, { id: res.data.id, name: res.data.name }]);
    setSubjectId(res.data.id);
    setNewSubject(null);
  };

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      subjectId: subjectId || null,
    };

    const schema = isEditing ? updateTaskSchema : createTaskSchema;
    const clientValidation = schema.safeParse(payload);
    if (!clientValidation.success) {
      setFieldErrors(clientValidation.error.flatten().fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSubmit(payload);
      if (!res.success) {
        setError(res.error || "Could not save the task");
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? "Edit task" : "New task"}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <ErrorNote>{error}</ErrorNote>}

        <Field label="What is it?" htmlFor="task-title" error={fieldErrors.title?.[0]}>
          <Input
            id="task-title"
            required
            autoFocus={!isEditing}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Database lab report"
          />
        </Field>

        <Field label="Subject" htmlFor="task-subject" error={subjectError ?? undefined}>
          {newSubject === null ? (
            <Select
              id="task-subject"
              value={subjectId}
              onChange={(e) => (e.target.value === "__new" ? setNewSubject("") : setSubjectId(e.target.value))}
            >
              <option value="">No subject</option>
              {subjectOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__new">New subject…</option>
            </Select>
          ) : (
            <div className="flex gap-2">
              <Input
                id="task-subject"
                autoFocus
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addSubject();
                  }
                }}
                placeholder="Subject name"
                maxLength={60}
              />
              <Button onClick={() => void addSubject()}>Add</Button>
              <Button variant="ghost" onClick={() => setNewSubject(null)}>
                Cancel
              </Button>
            </div>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Due" htmlFor="task-deadline" error={fieldErrors.deadline?.[0]} hint="Leave empty if there is no deadline.">
            <Input id="task-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>

          <Field
            label="Time needed (minutes)"
            htmlFor="task-duration"
            error={fieldErrors.estimatedMinutes?.[0]}
            hint="Without it the task cannot be planned."
          >
            <Input
              id="task-duration"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
            />
            <div className="mt-2 flex gap-1.5">
              {durationPresets.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setEstimatedMinutes(String(minutes))}
                  className={`h-8 flex-1 rounded-lg text-[13px] transition-colors ${
                    estimatedMinutes === String(minutes) ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:bg-line"
                  }`}
                >
                  {presetLabel(minutes)}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-soft">Priority</legend>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-paper p-1">
            {priorities.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={priority === p.value}
                onClick={() => setPriority(p.value)}
                className={`h-9 rounded-lg text-[13px] transition-colors ${
                  priority === p.value ? "bg-sheet font-medium text-ink shadow-[0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        {isEditing && (
          <Field label="Status" htmlFor="task-status">
            <Select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Notes" htmlFor="task-description" error={fieldErrors.description?.[0]}>
          <Textarea
            id="task-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Links, pages, anything you need to remember"
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEditing ? "Save" : "Add task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
