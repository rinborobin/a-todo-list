"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { discardStudyTimerAction, setStudyGoalAction, stopStudyTimerAction, type FocusData } from "@/actions/study";
import { GOAL_CHOICES, computeFocusTime, formatTimer } from "@/lib/study/focus-time";
import { formatDuration } from "@/lib/format";
import { RatingPicker } from "@/components/study/rating-picker";
import { SessionTopicPicker } from "@/components/study/topic-picker";
import { ResourceStep, TaskDoneToggle } from "@/components/study/follow-ups";
import type { SubjectKind } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { RollingDigits } from "./rolling-digits";
import { Sundial } from "./sundial";

type Mode = "down" | "up";

// Clock direction is a per-device preference; reading it through an external
// store keeps server and first client render identical ("down").
const MODE_KEY = "focus-clock-mode";
const modeListeners = new Set<() => void>();
function readMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === "up" ? "up" : "down";
  } catch {
    return "down";
  }
}
function writeMode(mode: Mode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
  modeListeners.forEach((listener) => listener());
}
function subscribeMode(listener: () => void) {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

/** Ticks on each whole second so the digits change in step with real time. */
function useSecondClock(initial: Date): Date {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    let interval: number | undefined;
    const align = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 1000);
    }, 1000 - (Date.now() % 1000));
    return () => {
      window.clearTimeout(align);
      window.clearInterval(interval);
    };
  }, []);
  return now;
}

/** Keeps the screen on while studying, where the browser supports it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) await lock.release();
      } catch {
        // Not allowed right now (e.g. low battery); the timer still works.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

interface FocusViewProps {
  /** The running timer, or null when none is running. */
  data: FocusData | null;
  initialNow: Date;
  /** True when arriving from Start: finish the flood animation. */
  entering: boolean;
}

type Phase =
  | { kind: "running" }
  | { kind: "confirm-discard" }
  | { kind: "finished"; sessionId: string; minutes: number; capped: boolean }
  | { kind: "too-short" };

export function FocusView({ data: incoming, initialNow, entering }: FocusViewProps) {
  const router = useRouter();
  // Keep the session we opened with: after Stop the page refreshes with no
  // running timer, and the finish screen still needs these details.
  const [opened] = useState(incoming);
  const data = incoming ?? opened;
  // Set while this screen is stopping or discarding, so the refresh that
  // follows is not mistaken for "stopped somewhere else".
  const endingRef = useRef(false);

  useEffect(() => {
    if (!incoming && !endingRef.current) router.replace("/today");
  }, [incoming, router]);

  if (!data) return null;
  return <FocusSession data={data} initialNow={initialNow} entering={entering} endingRef={endingRef} />;
}

function FocusSession({
  data,
  initialNow,
  entering,
  endingRef,
}: {
  data: FocusData;
  initialNow: Date;
  entering: boolean;
  endingRef: React.RefObject<boolean>;
}) {
  const router = useRouter();
  const now = useSecondClock(initialNow);
  const mode = useSyncExternalStore(subscribeMode, readMode, () => "down" as Mode);
  const [plannedMinutes, setPlannedMinutes] = useState(data.plannedMinutes);
  const [goalOpen, setGoalOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "running" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const stopButton = useRef<HTMLButtonElement>(null);

  const time = computeFocusTime(data.startedAt, now, plannedMinutes);
  const running = phase.kind === "running" || phase.kind === "confirm-discard";
  const subject = data.subjectName ?? "Studying";

  useWakeLock(running);

  // Drop the "from start" marker from the address bar without a navigation,
  // so a reload does not replay the entrance.
  useEffect(() => {
    if (entering) window.history.replaceState(null, "", "/focus");
  }, [entering]);

  // Browser tab title shows the time, handy on a laptop.
  const clockText = mode === "down" ? (time.goalReached ? `+${formatTimer(time.overSec)}` : formatTimer(time.leftSec)) : formatTimer(time.elapsedSec);
  useEffect(() => {
    if (!running) return;
    const previous = document.title;
    document.title = `${clockText} ${mode === "down" && !time.goalReached ? "left" : ""} · ${subject}`.replace(/\s+·/, " ·");
    return () => {
      document.title = previous;
    };
  }, [clockText, mode, running, subject, time.goalReached]);

  const stop = useCallback(() => {
    if (isPending || phase.kind !== "running") return;
    setError(null);
    endingRef.current = true;
    startTransition(async () => {
      const result = await stopStudyTimerAction();
      if (!result.success) {
        endingRef.current = false;
        setError(result.error);
        return;
      }
      const { session, discarded, capped } = result.data;
      if (!session || discarded) {
        setPhase({ kind: "too-short" });
        return;
      }
      setPhase({ kind: "finished", sessionId: session.id, minutes: session.minutes, capped });
    });
  }, [endingRef, isPending, phase.kind]);

  // Space stops the timer on a laptop (unless typing or on another control).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || phase.kind !== "running") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [contenteditable=true]")) return;
      event.preventDefault();
      stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, stop]);

  const changeGoal = (minutes: number) => {
    const previous = plannedMinutes;
    setPlannedMinutes(minutes);
    setGoalOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await setStudyGoalAction({ minutes });
      if (!result.success) {
        setPlannedMinutes(previous);
        setError(result.error);
      }
    });
  };

  const discard = () => {
    setError(null);
    endingRef.current = true;
    startTransition(async () => {
      const result = await discardStudyTimerAction();
      if (!result.success) {
        endingRef.current = false;
        setError(result.error);
        setPhase({ kind: "running" });
        return;
      }
      router.push("/today");
    });
  };

  const minutesStudied = Math.floor(time.elapsedSec / 60);
  const status = time.goalReached
    ? mode === "down"
      ? "Over goal"
      : "Goal reached"
    : mode === "down"
      ? "Left"
      : "Studied";
  const secondary = time.goalReached
    ? `${formatDuration(Math.max(1, Math.floor(time.overSec / 60)))} over · keep going or stop`
    : mode === "down"
      ? `${minutesStudied} min studied`
      : `${Math.ceil(time.leftSec / 60)} min left`;
  // Screen readers hear the time once a minute, not every second.
  const spokenMinute = time.goalReached
    ? `Goal reached. ${minutesStudied} minutes studied.`
    : `${Math.ceil(time.leftSec / 60)} minutes left.`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper text-ink">
      {entering && <div className="focus-flood-out pointer-events-none fixed inset-0 z-50 bg-ink" aria-hidden="true" />}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] lg:max-w-lg lg:py-10">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/today")}
            className="-ml-2 flex h-11 items-center gap-1 rounded-xl px-2 text-sm text-muted hover:text-ink"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Today
          </button>
          {running && (
            <button
              type="button"
              onClick={() => setGoalOpen((open) => !open)}
              aria-expanded={goalOpen}
              aria-controls="goal-choices"
              className="flex h-11 items-center rounded-xl px-3 text-sm text-ink-soft hover:bg-line/60"
            >
              Goal {formatDuration(plannedMinutes)}
            </button>
          )}
        </header>

        {running && goalOpen && (
          <div id="goal-choices" role="group" aria-label="Choose a goal" className="rise mt-2 flex flex-wrap justify-end gap-1.5">
            {GOAL_CHOICES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={plannedMinutes === minutes}
                onClick={() => changeGoal(minutes)}
                className={`h-10 min-w-14 rounded-xl px-3 text-sm transition-colors ${
                  plannedMinutes === minutes ? "bg-ink text-paper" : "bg-line/60 text-ink-soft hover:bg-line"
                }`}
              >
                {formatDuration(minutes)}
              </button>
            ))}
          </div>
        )}

        {phase.kind === "too-short" ? (
          <div className="rise flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-serif text-[30px] leading-tight">Under a minute</p>
            <p className="mt-2 text-[15px] text-muted">Sessions shorter than a minute are not saved.</p>
            <Button variant="primary" onClick={() => router.push("/today")} className="mt-8 h-14 w-full text-base">
              Back to Today
            </Button>
          </div>
        ) : phase.kind === "finished" ? (
          <Finished
            minutes={phase.minutes}
            capped={phase.capped}
            sessionId={phase.sessionId}
            subject={data.subjectName}
            subjectId={data.subjectId}
            kind={data.subjectKind}
            task={data.taskTitle}
            taskId={data.taskId}
            resourceNext={data.resourceNext}
            topics={data.subjectId && data.subjectKind !== "PROJECT" ? data.topics : null}
            topicId={data.topicId}
            onDone={() => router.push("/today")}
          />
        ) : (
          <>
            <div className={`mt-6 ${entering ? "focus-settle" : ""}`}>
              <h1 className="font-serif text-[28px] leading-tight lg:text-[32px]">{subject}</h1>
              {data.taskTitle && <p className="mt-0.5 text-[15px] text-muted">{data.taskTitle}</p>}
            </div>

            <div className={`flex flex-1 items-center justify-center py-8 ${entering ? "focus-settle" : ""}`}>
              <Sundial fractionLeft={time.fractionLeft} goalReached={time.goalReached}>
                <button
                  type="button"
                  onClick={() => writeMode(mode === "down" ? "up" : "down")}
                  className="flex h-full w-full flex-col items-center justify-center rounded-full"
                  aria-label={`Showing ${mode === "down" ? "time left" : "time studied"}. Switch to ${mode === "down" ? "time studied" : "time left"}.`}
                >
                  <span className={`text-xs ${time.goalReached ? "text-accent" : "text-muted"}`}>{status}</span>
                  <RollingDigits
                    text={clockText}
                    direction={mode === "down" && !time.goalReached ? "down" : "up"}
                    label={clockText}
                    className="mt-1 font-serif text-[clamp(40px,12vw,56px)] font-light leading-none lg:text-[60px]"
                  />
                  <span className={`mt-2 px-3 text-center text-[13px] ${time.goalReached ? "text-accent" : "text-muted"}`}>
                    {secondary}
                  </span>
                </button>
              </Sundial>
            </div>
            <p className="sr-only" aria-live="polite">
              {spokenMinute}
            </p>

            {error && <p className="mb-3 text-center text-sm text-danger">{error}</p>}

            {phase.kind === "confirm-discard" ? (
              <div className="rise rounded-2xl bg-sheet p-4 shadow-[0_0_0_1px_var(--line-strong)]">
                <p className="text-[15px]">
                  Discard {minutesStudied > 0 ? formatDuration(minutesStudied) : "this session"}? It will not be saved.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="danger" onClick={discard} disabled={isPending} className="flex-1">
                    {isPending ? "Discarding…" : "Discard"}
                  </Button>
                  <Button
                    onClick={() => {
                      setPhase({ kind: "running" });
                      stopButton.current?.focus();
                    }}
                    className="flex-1"
                  >
                    Keep studying
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`flex items-center gap-2 ${entering ? "focus-settle" : ""}`}>
                <Button
                  variant="ghost"
                  onClick={() => setPhase({ kind: "confirm-discard" })}
                  disabled={isPending}
                  className="h-14 px-5"
                >
                  Discard
                </Button>
                <button
                  ref={stopButton}
                  type="button"
                  onClick={stop}
                  disabled={isPending}
                  className="h-14 flex-1 rounded-2xl bg-ink text-base font-medium text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {isPending ? "Saving…" : "Stop"}
                  <span className="ml-2 hidden text-xs font-normal opacity-60 lg:inline">Space</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Finished({
  minutes,
  capped,
  sessionId,
  subject,
  subjectId,
  kind,
  task,
  taskId,
  resourceNext,
  topics,
  topicId,
  onDone,
}: {
  minutes: number;
  capped: boolean;
  sessionId: string;
  subject: string | null;
  subjectId: string | null;
  kind: SubjectKind | null;
  task: string | null;
  taskId: string | null;
  /** Self-learning: the next unit of the book or course, e.g. "Lesson 19". */
  resourceNext: string | null;
  /** Null when the session has no subject (topics need one). */
  topics: { id: string; name: string }[] | null;
  topicId: string | null;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(0);

  // Count the logged minutes up once; instantly when motion is reduced.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.requestAnimationFrame(() => setShown(minutes));
      return () => window.cancelAnimationFrame(id);
    }
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      setShown(Math.round(minutes * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [minutes]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
        <circle cx="32" cy="32" r="32" className="check-pop fill-ink" />
        <path d="M20 33l8 8 16-18" className="check-draw fill-none stroke-paper" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="mt-5 font-serif text-[34px] leading-tight" role="status">
        Logged {formatDuration(shown) || "0m"}
      </p>
      <p className="mt-1 text-[15px] text-muted">{[subject, task].filter(Boolean).join(" · ") || "Study session"}</p>
      {capped && <p className="mt-2 text-[13px] text-muted">The timer ran over 8 hours, so it was capped at 8h.</p>}

      {kind === "PROJECT" ? (
        taskId &&
        task && (
          <div className="rise mt-8 w-full max-w-sm" style={{ animationDelay: "0.45s" }}>
            <TaskDoneToggle taskId={taskId} title={task} />
          </div>
        )
      ) : (
        <div className="rise mt-8 flex flex-col items-center gap-2" style={{ animationDelay: "0.45s" }}>
          <p className="text-sm text-muted">How did it go?</p>
          <RatingPicker sessionId={sessionId} />
        </div>
      )}
      {kind === "SELF_LEARNING" && subjectId && resourceNext && (
        <div className="rise mt-6" style={{ animationDelay: "0.5s" }}>
          <ResourceStep subjectId={subjectId} next={resourceNext} />
        </div>
      )}
      {topics && (
        <div className="rise mt-6 w-full max-w-sm text-left" style={{ animationDelay: "0.55s" }}>
          <SessionTopicPicker sessionId={sessionId} topics={topics} initialTopicId={topicId} />
        </div>
      )}
      <div className="rise mt-8 w-full" style={{ animationDelay: "0.6s" }}>
        <Button variant="primary" onClick={onDone} className="h-14 w-full text-base">
          Back to Today
        </Button>
      </div>
    </div>
  );
}
