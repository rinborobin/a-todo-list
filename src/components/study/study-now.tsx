"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { discardStudyTimerAction, startStudyTimerAction, stopStudyTimerAction } from "@/actions/study";
import type { StudyNextSuggestion } from "@/lib/study/next";
import { formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RatingPicker } from "./rating-picker";
import { useMinuteClock } from "./use-minute-clock";

export interface RunningTimer {
  id: string;
  startedAt: Date;
  subjectName: string | null;
  taskTitle: string | null;
}

interface StudyNowProps {
  suggestion: StudyNextSuggestion | null;
  running: RunningTimer | null;
  subjects: { id: string; name: string }[];
  initialNow: Date;
}

const label = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

/**
 * "Study next" suggestion with a one-tap timer. While a timer runs it shows the
 * elapsed time; after stopping it asks how the session went.
 */
export function StudyNow({ suggestion, running, subjects, initialNow }: StudyNowProps) {
  const router = useRouter();
  const now = useMinuteClock(initialNow);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<{ sessionId: string; minutes: number; note: string | null } | null>(null);

  const run = (action: () => Promise<{ success: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      after?.();
      router.refresh();
    });
  };

  const start = (subjectId: string | null, taskId: string | null) =>
    run(() => startStudyTimerAction({ subjectId, taskId }), () => setFinished(null));

  const stop = () => {
    setError(null);
    startTransition(async () => {
      const result = await stopStudyTimerAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      const { session, discarded, capped } = result.data;
      if (session && !discarded) {
        setFinished({
          sessionId: session.id,
          minutes: session.minutes,
          note: capped ? "The timer ran over 8 hours, so it was capped at 8h." : null,
        });
      } else {
        setFinished(null);
        setError("Under a minute, so it was not saved.");
      }
      router.refresh();
    });
  };

  if (running) {
    const minutes = Math.max(0, Math.floor((now.getTime() - running.startedAt.getTime()) / 60_000));
    return (
      <section aria-label="Study timer" className="border-l-2 border-ink pl-4">
        <p className={label}>Studying</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-serif text-2xl">{minutes < 1 ? "Just started" : formatDuration(minutes)}</span>
          <span className="text-[15px] font-medium">{running.subjectName ?? "No subject"}</span>
          {running.taskTitle && <span className="text-sm text-muted">{running.taskTitle}</span>}
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={stop} disabled={isPending}>
            {isPending ? "Saving…" : "Stop"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => run(discardStudyTimerAction)} disabled={isPending}>
            Discard
          </Button>
        </div>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </section>
    );
  }

  if (finished) {
    return (
      <section aria-label="Session saved" className="border-l-2 border-ink pl-4">
        <p className={label}>Saved {formatDuration(finished.minutes)}</p>
        {finished.note && <p className="mt-1 text-[13px] text-muted">{finished.note}</p>}
        <div className="mt-2">
          <RatingPicker sessionId={finished.sessionId} prompt onDone={() => setFinished(null)} />
        </div>
      </section>
    );
  }

  if (subjects.length === 0) {
    return (
      <p className="text-sm text-muted">
        <Link href="/me" className="font-medium text-ink underline-offset-4 hover:underline">
          Add your subjects
        </Link>{" "}
        to track study time and get suggestions on what to study next.
      </p>
    );
  }

  return (
    <section aria-label="Study next" className="border-l-2 border-ink pl-4">
      <p className={label}>Study next</p>
      {suggestion ? (
        <>
          <p className="mt-1 text-[15px]">
            <span className="font-semibold">{suggestion.subjectName}</span>
            {suggestion.taskTitle && <span className="text-ink-soft"> · {suggestion.taskTitle}</span>}
            <span className="text-muted"> · {formatDuration(suggestion.minutes)}</span>
          </p>
          {suggestion.reason && <p className="text-[13px] text-muted">{suggestion.reason}</p>}
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">Pick a subject to start a timer.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {suggestion && (
          <Button
            variant="primary"
            size="sm"
            disabled={isPending}
            onClick={() => start(suggestion.subjectId, suggestion.taskId)}
          >
            {isPending ? "Starting…" : "Start"}
          </Button>
        )}
        <label htmlFor="study-other" className="sr-only">
          Study another subject
        </label>
        <select
          id="study-other"
          value=""
          disabled={isPending}
          onChange={(e) => e.target.value && start(e.target.value, null)}
          className="h-8 cursor-pointer rounded-lg bg-transparent px-1 text-[13px] text-muted hover:text-ink focus:outline-none"
        >
          <option value="">{suggestion ? "or something else…" : "Choose a subject…"}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </section>
  );
}
