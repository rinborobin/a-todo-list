"use client";

import { useState, useTransition } from "react";
import { updateSubjectSetupAction } from "@/actions/study";
import type { SubjectConfidence } from "@/db/schema";
import { formatDuration } from "@/lib/format";

export interface SetupSubject {
  id: string;
  name: string;
  confidence: SubjectConfidence | null;
  examDate: string | null;
  weeklyGoalMinutes: number | null;
}

const CONFIDENCE: { value: SubjectConfidence; label: string }[] = [
  { value: "WEAK", label: "Weak" },
  { value: "OK", label: "OK" },
  { value: "STRONG", label: "Strong" },
];
const GOALS = [0, 60, 120, 240, 360];

const segment = (active: boolean) =>
  `h-10 flex-1 rounded-lg text-sm transition-colors ${
    active ? "bg-sheet font-medium text-ink shadow-[0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink"
  }`;

function formatExam(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

/**
 * Confidence, exam date and weekly goal for one subject. Every change saves
 * straight away; all three are optional.
 */
export function SubjectSetupFields({ subject, today }: { subject: SetupSubject; today: string }) {
  const [value, setValue] = useState(subject);
  const [examOpen, setExamOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = (changes: Partial<Omit<SetupSubject, "id" | "name">>) => {
    const previous = value;
    setValue((v) => ({ ...v, ...changes }));
    setError(null);
    startTransition(async () => {
      const result = await updateSubjectSetupAction({ id: subject.id, ...changes });
      if (!result.success) {
        setValue(previous);
        setError(result.error);
      }
    });
  };

  const id = (part: string) => `${part}-${subject.id}`;

  return (
    <div className="space-y-4">
      <div>
        <p id={id("conf")} className="mb-1.5 text-[13px] text-ink-soft">
          How confident do you feel?
        </p>
        <div role="group" aria-labelledby={id("conf")} className="grid grid-cols-3 gap-1 rounded-xl bg-line/50 p-1">
          {CONFIDENCE.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value.confidence === option.value}
              onClick={() => save({ confidence: value.confidence === option.value ? null : option.value })}
              className={segment(value.confidence === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p id={id("goal")} className="mb-1.5 text-[13px] text-ink-soft">
          Hours a week you want to spend on it
        </p>
        <div role="group" aria-labelledby={id("goal")} className="grid grid-cols-5 gap-1 rounded-xl bg-line/50 p-1">
          {GOALS.map((minutes) => {
            const active = (value.weeklyGoalMinutes ?? 0) === minutes;
            return (
              <button
                key={minutes}
                type="button"
                aria-pressed={active}
                onClick={() => save({ weeklyGoalMinutes: minutes === 0 ? null : minutes })}
                className={segment(active)}
              >
                {minutes === 0 ? "None" : formatDuration(minutes)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {value.examDate && !examOpen ? (
          <p className="flex flex-wrap items-center gap-x-3 text-sm">
            <span>
              Exam on <span className="font-medium">{formatExam(value.examDate)}</span>
            </span>
            <button type="button" onClick={() => setExamOpen(true)} className="text-muted underline-offset-4 hover:text-ink hover:underline">
              Change
            </button>
            <button type="button" onClick={() => save({ examDate: null })} className="text-muted underline-offset-4 hover:text-ink hover:underline">
              Remove
            </button>
          </p>
        ) : examOpen ? (
          <div>
            <label htmlFor={id("exam")} className="mb-1.5 block text-[13px] text-ink-soft">
              Exam date
            </label>
            <input
              id={id("exam")}
              type="date"
              min={today}
              defaultValue={value.examDate ?? ""}
              autoFocus
              onChange={(e) => {
                if (e.target.value) {
                  save({ examDate: e.target.value });
                  setExamOpen(false);
                }
              }}
              className="h-11 w-full rounded-xl border border-line-strong bg-sheet px-3 text-base text-ink focus:border-ink focus:outline-none sm:text-sm"
            />
          </div>
        ) : (
          <button type="button" onClick={() => setExamOpen(true)} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            Add an exam date
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** One-line summary, e.g. "Weak · 4h a week · exam 15 Dec 2026". */
export function describeSetup(subject: Omit<SetupSubject, "id" | "name">): string {
  const parts: string[] = [];
  if (subject.confidence) parts.push(CONFIDENCE.find((c) => c.value === subject.confidence)!.label);
  if (subject.weeklyGoalMinutes) parts.push(`${formatDuration(subject.weeklyGoalMinutes)} a week`);
  if (subject.examDate) parts.push(`exam ${formatExam(subject.examDate)}`);
  return parts.join(" · ");
}
