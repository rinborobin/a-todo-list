"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startStudyTimerAction, stopStudyTimerAction } from "@/actions/study";
import type { StudyNextSuggestion } from "@/lib/study/next";
import { defaultGoalMinutes } from "@/lib/study/focus-time";
import { formatDuration } from "@/lib/format";
import { Button, buttonClasses } from "@/components/ui/button";
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
  // Origin of the shade that floods the screen when Start is tapped.
  const [flood, setFlood] = useState<{ x: number; y: number } | null>(null);

  /**
   * Starts the timer and opens the focus screen. The flood animation and the
   * save run at the same time, so the focus screen is ready as the shade
   * covers the page; if saving fails the shade lifts and the error shows.
   */
  const start = (subjectId: string | null, taskId: string | null, plannedMinutes: number, origin?: HTMLElement | null) => {
    setError(null);
    setFinished(null);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (origin && !reduceMotion) {
      const rect = origin.getBoundingClientRect();
      setFlood({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
    startTransition(async () => {
      const [result] = await Promise.all([
        startStudyTimerAction({ subjectId, taskId, plannedMinutes }),
        new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : 520)),
      ]);
      if (!result.success) {
        setFlood(null);
        setError(result.error);
        return;
      }
      router.push(reduceMotion ? "/focus" : "/focus?from=start");
    });
  };

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
          <Link href="/focus" className={buttonClasses("primary", "sm")}>
            Open timer
          </Link>
          <Button variant="ghost" size="sm" onClick={stop} disabled={isPending}>
            {isPending ? "Saving…" : "Stop"}
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
      <section aria-label="Set up studying" className="border-l-2 border-ink pl-4">
        <p className="text-[15px]">Tell the app what you are studying.</p>
        <p className="text-[13px] text-muted">It learns from your sessions and suggests what to study next.</p>
        <Link href="/setup" className={`${buttonClasses("primary", "sm")} mt-3`}>
          Set up subjects
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Study next" className="border-l-2 border-ink pl-4">
      {flood && (
        <div
          className="focus-flood-in fixed inset-0 z-50 bg-ink"
          style={{ "--x": `${flood.x}px`, "--y": `${flood.y}px` } as React.CSSProperties}
          aria-hidden="true"
        />
      )}
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
            onClick={(e) => start(suggestion.subjectId, suggestion.taskId, defaultGoalMinutes(suggestion.minutes), e.currentTarget)}
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
          onChange={(e) => e.target.value && start(e.target.value, null, defaultGoalMinutes(null), e.currentTarget)}
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
