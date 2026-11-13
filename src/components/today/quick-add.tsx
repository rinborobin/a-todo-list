"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { quickAddTaskAction } from "@/actions/planner";
import { parseQuickAdd, type QuickAddResult } from "@/lib/quick-add/parse";
import { describeDue, formatDuration } from "@/lib/format";
import { PlusIcon } from "@/components/ui/icons";

const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" } as const;

function formatDeadline(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/**
 * One-line task entry. On phones it floats above the tab bar; on laptops it
 * sits at the top of the side column. Press "n" anywhere to focus it.
 */
export function QuickAdd({ timezone, subjects = [] }: { timezone: string; subjects?: { id: string; name: string }[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<QuickAddResult | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], dialog[open]")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onChange = (value: string) => {
    setText(value);
    setMessage(null);
    setParsed(value.trim() ? parseQuickAdd(value, { now: new Date(), timezone, subjects }) : null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed) return;
    if (!parsed.title) {
      setMessage({ tone: "error", text: "Add a few words about the task, not only the date." });
      return;
    }

    startTransition(async () => {
      const result = await quickAddTaskAction({
        title: parsed.title,
        priority: parsed.priority,
        status: "TODO",
        estimatedMinutes: parsed.estimatedMinutes,
        deadline: parsed.deadline?.toISOString() ?? null,
        subjectId: parsed.subjectId,
      });

      if (!result.success) {
        setMessage({ tone: "error", text: result.error });
        return;
      }

      const { plannedAt, notPlannedReason } = result.data;
      setText("");
      setParsed(null);
      setMessage(
        plannedAt
          ? { tone: "ok", text: `Added. Planned ${describeDue(plannedAt, new Date(), timezone).label}.` }
          : { tone: "ok", text: `Added. Not planned yet: ${notPlannedReason?.toLowerCase() ?? "no free time"}.` }
      );
    });
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-20 flex flex-col-reverse gap-2 lg:static lg:flex-col">
      <form
        onSubmit={submit}
        className="flex h-12 items-center gap-2 rounded-2xl border border-line-strong bg-sheet pl-4 pr-1.5 shadow-[0_6px_20px_rgb(28_25_23/0.08)] focus-within:border-ink lg:shadow-none"
      >
        <label htmlFor="quick-add" className="sr-only">
          Add a task or deadline
        </label>
        <input
          ref={inputRef}
          id="quick-add"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={subjects.length > 0 ? "Add a task: essay #calc fri 5pm 2h" : "Add a task: essay due fri 5pm 2h"}
          autoComplete="off"
          enterKeyHint="done"
          maxLength={200}
          className="h-full min-w-0 flex-1 bg-transparent text-base placeholder:text-faint focus:outline-none sm:text-[15px]"
        />
        <kbd className="hidden rounded-md border border-line px-1.5 text-[11px] text-faint lg:inline">N</kbd>
        <button
          type="submit"
          disabled={!parsed || isPending}
          aria-label="Add task"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-paper disabled:opacity-30"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </form>

      {(parsed || message) && (
        <div
          aria-live="polite"
          className="rounded-2xl border border-line bg-sheet px-4 py-3 text-[13px] shadow-[0_6px_20px_rgb(28_25_23/0.08)] lg:shadow-none"
        >
          {parsed && (
            <dl className="flex flex-wrap gap-x-4 gap-y-1">
              <div className="flex gap-1.5">
                <dt className="text-muted">Task</dt>
                <dd className="font-medium">{parsed.title || "–"}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">Due</dt>
                <dd className={parsed.deadline ? "font-medium text-accent" : "text-faint"}>
                  {parsed.deadline ? formatDeadline(parsed.deadline, timezone) : "none"}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">Needs</dt>
                <dd className="font-medium">
                  {formatDuration(parsed.estimatedMinutes)}
                  {parsed.estimateIsDefault && <span className="font-normal text-faint"> (default)</span>}
                </dd>
              </div>
              {parsed.subjectTag && (
                <div className="flex gap-1.5">
                  <dt className="text-muted">Subject</dt>
                  <dd className={parsed.subjectId ? "font-medium" : "text-danger"}>
                    {parsed.subjectId
                      ? subjects.find((s) => s.id === parsed.subjectId)?.name
                      : `No subject called "${parsed.subjectTag}"`}
                  </dd>
                </div>
              )}
              {parsed.priority !== "MEDIUM" && (
                <div className="flex gap-1.5">
                  <dt className="text-muted">Priority</dt>
                  <dd className="font-medium">{PRIORITY_LABEL[parsed.priority]}</dd>
                </div>
              )}
            </dl>
          )}
          {message && (
            <p className={`${parsed ? "mt-2" : ""} ${message.tone === "error" ? "text-danger" : "text-ink-soft"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
