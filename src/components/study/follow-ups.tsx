"use client";

import { useState, useTransition } from "react";
import { advanceResourceAction } from "@/actions/study";
import { toggleTaskStatusAction } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";

/**
 * Self-learning: one tap after a session moves the book or course on
 * ("Finished Lesson 19?"), with undo.
 */
export function ResourceStep({ subjectId, next }: { subjectId: string; next: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const change = (delta: 1 | -1) => {
    setError(null);
    startTransition(async () => {
      const result = await advanceResourceAction({ subjectId, delta });
      if (!result.success) setError(result.error);
      else setDone(delta === 1);
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {done ? (
        <p className="flex items-center gap-2 text-sm" role="status">
          <CheckIcon className="h-4 w-4" />
          {next} done
          <button
            type="button"
            disabled={isPending}
            onClick={() => change(-1)}
            className="text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Undo
          </button>
        </p>
      ) : (
        <Button disabled={isPending} onClick={() => change(1)}>
          Finished {next}?
        </Button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Side project: mark the task worked on as done, with undo. */
export function TaskDoneToggle({ taskId, title }: { taskId: string; title: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await toggleTaskStatusAction(taskId, next ? "COMPLETED" : "TODO");
      if (!result.success) setError(result.error);
      else setDone(next);
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {done ? (
        <p className="flex items-center gap-2 text-sm" role="status">
          <CheckIcon className="h-4 w-4" />
          <span className="max-w-[16rem] truncate">{title}</span> done
          <button
            type="button"
            disabled={isPending}
            onClick={() => set(false)}
            className="text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Undo
          </button>
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">Did you finish it?</p>
          <Button disabled={isPending} onClick={() => set(true)} className="max-w-full">
            <CheckIcon className="h-4 w-4" />
            <span className="truncate">Mark {title} done</span>
          </Button>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
