"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { updateScheduleItemStatusAction, type PlanWithItems } from "@/actions/planner";
import { describeDue, formatClock, formatDuration, formatStartsIn } from "@/lib/format";
import { CheckIcon } from "@/components/ui/icons";
import { RatingPicker } from "@/components/study/rating-picker";
import { SessionTopicPicker } from "@/components/study/topic-picker";
import { ResourceStep } from "@/components/study/follow-ups";
import type { SubjectKind } from "@/db/schema";

export interface RailSubject {
  id: string;
  kind: SubjectKind;
  /** Self-learning: the next unit of the book or course, e.g. "Lesson 19". */
  resourceNext: string | null;
}

type Item = PlanWithItems["items"][number];
type Status = Item["status"];

interface DayRailProps {
  items: Item[];
  timezone: string;
  now: Date;
  /** Show the "now" marker and highlight the next block (only for today). */
  live?: boolean;
  onStatusChange?: (id: string, status: Status) => void;
  /** Topics with their subject, offered after a block is ticked. */
  topics?: { id: string; name: string; subjectId: string }[];
  /** Kinds of subjects, so the prompt after a block fits (no rating for projects). */
  subjects?: RailSubject[];
}

const FREE_GAP_MINUTES = 15;

export function DayRail({ items, timezone, now, live = false, onStatusChange, topics = [], subjects = [] }: DayRailProps) {
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const [error, setError] = useState<string | null>(null);
  const [ratingPrompt, setRatingPrompt] = useState<{ itemId: string; sessionId: string } | null>(null);
  const [, startTransition] = useTransition();

  const sorted = [...items]
    .map((item) => ({ ...item, status: overrides[item.id] ?? item.status }))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const nextId = live
    ? sorted.find((item) => item.status === "SCHEDULED" && item.endTime > now)?.id
    : undefined;
  const nowIndex = live ? sorted.findIndex((item) => item.startTime > now) : -1;

  const toggle = (item: Item & { status: Status }) => {
    const next: Status = item.status === "COMPLETED" ? "SCHEDULED" : "COMPLETED";
    setError(null);
    setOverrides((prev) => ({ ...prev, [item.id]: next }));
    onStatusChange?.(item.id, next);
    startTransition(async () => {
      const result = await updateScheduleItemStatusAction(item.id, { status: next });
      if (!result.success) {
        setOverrides((prev) => ({ ...prev, [item.id]: item.status }));
        onStatusChange?.(item.id, item.status);
        setError(result.error);
        return;
      }
      const sessionId = result.data.studySessionId;
      setRatingPrompt(next === "COMPLETED" && sessionId ? { itemId: item.id, sessionId } : null);
    });
  };

  const nowMarker = (
    <li key="now" className="relative -my-1 flex h-6 items-center" aria-label={`Now, ${formatClock(now, timezone)}`}>
      <span className="absolute -left-[23px] h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
      <span className="h-px flex-1 bg-accent" aria-hidden="true" />
      <span className="tabular pl-2 text-[11px] font-semibold text-accent">{formatClock(now, timezone)}</span>
    </li>
  );

  return (
    <div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <ol className="relative ml-[9px] border-l border-line-strong pl-6">
        {live && nowIndex === 0 && nowMarker}
        {sorted.map((item, index) => {
          const prev = sorted[index - 1];
          const gapMinutes = prev ? Math.round((item.startTime.getTime() - prev.endTime.getTime()) / 60_000) : 0;
          const isNext = item.id === nextId;
          const isDone = item.status === "COMPLETED";
          const isSkipped = item.status === "SKIPPED";
          const minutes = Math.round((item.endTime.getTime() - item.startTime.getTime()) / 60_000);
          const due = item.task?.deadline ? describeDue(item.task.deadline, now, timezone) : null;
          const title = item.task?.title ?? "Removed task";
          const railSubject = item.task?.subjectId ? subjects.find((s) => s.id === item.task!.subjectId) : undefined;

          return (
            <Fragment key={item.id}>
              {gapMinutes >= FREE_GAP_MINUTES && (
                <li className="py-1 font-serif text-sm italic text-faint">{formatDuration(gapMinutes)} free</li>
              )}
              {live && index > 0 && index === nowIndex && nowMarker}
              <li className="relative py-2.5">
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  disabled={isSkipped}
                  aria-label={isDone ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
                  aria-pressed={isDone}
                  className="absolute -left-[38px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full"
                >
                  <span
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] transition-colors ${
                      isDone
                        ? "border-ink bg-ink text-paper"
                        : isNext
                          ? "border-[5px] border-ink bg-paper"
                          : "border-faint bg-paper hover:border-ink"
                    }`}
                  >
                    {isDone && <CheckIcon className="h-2.5 w-2.5" />}
                  </span>
                </button>

                {isNext ? (
                  <p className="flex items-baseline gap-2">
                    <span className="tabular font-serif text-[34px] leading-none">{formatClock(item.startTime, timezone)}</span>
                    <span className="text-[13px] font-medium text-accent">
                      {item.startTime > now ? formatStartsIn(item.startTime, now) : "now"}
                    </span>
                  </p>
                ) : (
                  <p className={`tabular text-xs ${isDone || isSkipped ? "text-faint" : "text-muted"}`}>
                    {formatClock(item.startTime, timezone)}–{formatClock(item.endTime, timezone)}
                  </p>
                )}

                <p
                  className={`mt-0.5 ${isNext ? "text-[17px] font-semibold" : "text-[15px] font-medium"} ${
                    isDone ? "text-faint line-through decoration-faint" : isSkipped ? "text-faint" : ""
                  }`}
                >
                  {item.task ? (
                    <Link href={`/tasks/${item.task.id}`} prefetch={false} className="hover:underline">
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                </p>

                <p className="text-[13px] text-muted">
                  {isNext ? `until ${formatClock(item.endTime, timezone)} · ` : ""}
                  {formatDuration(minutes)}
                  {isSkipped && " · Skipped"}
                  {due && !isDone && (
                    <span className={due.tone === "normal" ? "" : "text-accent"}>
                      {due.tone === "overdue" ? " · overdue" : ` · due ${due.label.replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}`}
                    </span>
                  )}
                </p>

                {/* Ticking a project block already finishes its task: nothing to rate. */}
                {ratingPrompt?.itemId === item.id && isDone && railSubject?.kind !== "PROJECT" && (
                  <div className="mt-2 space-y-3">
                    <RatingPicker sessionId={ratingPrompt.sessionId} prompt onDone={() => setRatingPrompt(null)} />
                    {railSubject?.kind === "SELF_LEARNING" && railSubject.resourceNext && (
                      <div className="flex">
                        <ResourceStep subjectId={railSubject.id} next={railSubject.resourceNext} />
                      </div>
                    )}
                    {item.task?.subjectId && (
                      <SessionTopicPicker
                        sessionId={ratingPrompt.sessionId}
                        topics={topics.filter((t) => t.subjectId === item.task!.subjectId)}
                        label="Topic covered (optional)"
                      />
                    )}
                  </div>
                )}
              </li>
            </Fragment>
          );
        })}
        {live && nowIndex === -1 && sorted.length > 0 && nowMarker}
      </ol>
    </div>
  );
}
