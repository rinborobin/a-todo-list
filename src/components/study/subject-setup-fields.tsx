"use client";

import { useState, useTransition } from "react";
import { updateSubjectSetupAction } from "@/actions/study";
import type { Subject, SubjectConfidence, SubjectKind } from "@/db/schema";
import { Input, Select } from "@/components/ui/field";
import { formatDuration } from "@/lib/format";
import { KIND_LABEL, KIND_OPTIONS } from "@/lib/study/labels";
import { resourceProgress } from "@/lib/study/progress";
import { MilestonesEditor, type EditableMilestone } from "./milestones-editor";

export interface SetupSubject {
  id: string;
  name: string;
  kind: SubjectKind;
  confidence: SubjectConfidence | null;
  /** Exam date for a class, target date for self-learning. */
  examDate: string | null;
  weeklyGoalMinutes: number | null;
  practiceDaysPerWeek: number | null;
  resourceName: string | null;
  resourceUnit: string | null;
  resourceTotal: number | null;
  resourceDone: number;
}

type Editable = Omit<SetupSubject, "id" | "name">;

const CONFIDENCE: { value: SubjectConfidence; label: string }[] = [
  { value: "WEAK", label: "Weak" },
  { value: "OK", label: "OK" },
  { value: "STRONG", label: "Strong" },
];
const GOALS = [0, 60, 120, 240, 360];
const PRACTICE_DAYS: { value: number | null; label: string }[] = [
  { value: null, label: "None" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 5, label: "5" },
  { value: 7, label: "Daily" },
];
const UNITS = ["lesson", "chapter", "unit", "module", "video", "page"];

const segment = (active: boolean) =>
  `press h-10 flex-1 rounded-lg text-sm transition-colors ${
    active ? "bg-sheet font-medium text-ink shadow-[0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-ink"
  }`;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

function parseCount(text: string): number | null {
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * The details of one thing the student works on, by kind. Every change saves
 * straight away; all of it is optional.
 * - Class: confidence, weekly hours, exam date.
 * - Self-learning: confidence, weekly hours, practice days, target date, and
 *   the book or course being worked through.
 * - Side project: weekly hours and milestones.
 */
export function SubjectSetupFields({
  subject,
  today,
  showKind = false,
  milestones,
  milestoneProgress,
  onSaved,
}: {
  subject: SetupSubject;
  today: string;
  /** Show the Class / Side project / Self-learning choice (setup asks it on step 1). */
  showKind?: boolean;
  milestones?: EditableMilestone[];
  milestoneProgress?: Record<string, { done: number; total: number }>;
  /** Called with the stored row after each save. */
  onSaved?: (subject: Subject) => void;
}) {
  const [value, setValue] = useState(subject);
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = (changes: Partial<Editable>) => {
    const previous = value;
    setValue((v) => ({ ...v, ...changes }));
    setError(null);
    startTransition(async () => {
      const result = await updateSubjectSetupAction({ id: subject.id, ...changes });
      if (!result.success) {
        setValue(previous);
        setError(result.error);
      } else {
        // The server may clamp (done never above total); keep what it stored.
        setValue((v) => ({ ...v, resourceDone: result.data.resourceDone }));
        onSaved?.(result.data);
      }
    });
  };

  const id = (part: string) => `${part}-${subject.id}`;
  const kind = value.kind;
  const isClass = kind === "CLASS";

  return (
    <div className="space-y-4">
      {showKind && (
        <div>
          <p id={id("kind")} className="mb-1.5 text-[13px] text-ink-soft">
            What is it?
          </p>
          <KindPicker labelledBy={id("kind")} value={kind} onChange={(next) => save({ kind: next })} />
        </div>
      )}

      {kind !== "PROJECT" && (
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
      )}

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

      {kind === "SELF_LEARNING" && (
        <div>
          <p id={id("days")} className="mb-1.5 text-[13px] text-ink-soft">
            Days a week to practise
          </p>
          <div role="group" aria-labelledby={id("days")} className="grid grid-cols-5 gap-1 rounded-xl bg-line/50 p-1">
            {PRACTICE_DAYS.map((option) => {
              const active = (value.practiceDaysPerWeek ?? null) === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => save({ practiceDaysPerWeek: option.value })}
                  className={segment(active)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {kind !== "PROJECT" && (
        <div>
          {value.examDate && !dateOpen ? (
            <p className="flex flex-wrap items-center gap-x-3 text-sm">
              <span>
                {isClass ? "Exam on" : "Finish by"} <span className="font-medium">{formatDate(value.examDate)}</span>
              </span>
              <button
                type="button"
                onClick={() => setDateOpen(true)}
                className="text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => save({ examDate: null })}
                className="text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Remove
              </button>
            </p>
          ) : dateOpen ? (
            <div>
              <label htmlFor={id("date")} className="mb-1.5 block text-[13px] text-ink-soft">
                {isClass ? "Exam date" : "Finish by"}
              </label>
              <input
                id={id("date")}
                type="date"
                min={today}
                defaultValue={value.examDate ?? ""}
                autoFocus
                onChange={(e) => {
                  if (e.target.value) {
                    save({ examDate: e.target.value });
                    setDateOpen(false);
                  }
                }}
                className="h-11 w-full rounded-xl border border-line-strong bg-sheet px-3 text-base text-ink focus:border-ink focus:outline-none sm:text-sm"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDateOpen(true)}
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {isClass ? "Add an exam date" : "Add a target date"}
            </button>
          )}
        </div>
      )}

      {kind === "SELF_LEARNING" && <ResourceFields key={value.resourceDone} value={value} idFor={id} save={save} />}

      {kind === "PROJECT" && (
        <MilestonesEditor subjectId={subject.id} initialMilestones={milestones ?? []} progress={milestoneProgress} />
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** The book or course: name, unit, how many units and how many are done. */
function ResourceFields({
  value,
  idFor,
  save,
}: {
  value: SetupSubject;
  idFor: (part: string) => string;
  save: (changes: Partial<Editable>) => void;
}) {
  const unit = value.resourceUnit ?? "lesson";
  // Picking a name or total for the first time also stores the unit shown.
  const withUnit = (changes: Partial<Editable>) =>
    save(value.resourceUnit ? changes : { ...changes, resourceUnit: unit });

  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] text-ink-soft">Book or course you are working through</legend>
      <div className="space-y-2">
        <label htmlFor={idFor("res-name")} className="sr-only">
          Name of the book or course
        </label>
        <Input
          id={idFor("res-name")}
          defaultValue={value.resourceName ?? ""}
          placeholder="Genki I, The Rust Book, ..."
          maxLength={80}
          onBlur={(e) => {
            const next = e.target.value.trim() || null;
            if (next !== (value.resourceName ?? null)) withUnit({ resourceName: next });
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor={idFor("res-unit")} className="mb-1 block text-[12px] text-muted">
              Made of
            </label>
            <Select
              id={idFor("res-unit")}
              value={UNITS.includes(unit) ? unit : "lesson"}
              onChange={(e) => save({ resourceUnit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}s
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor={idFor("res-total")} className="mb-1 block text-[12px] text-muted">
              How many
            </label>
            <Input
              id={idFor("res-total")}
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              defaultValue={value.resourceTotal ?? ""}
              placeholder="40"
              onBlur={(e) => {
                const next = parseCount(e.target.value);
                const total = next !== null && next >= 1 ? Math.min(next, 10000) : null;
                if (total !== value.resourceTotal) withUnit({ resourceTotal: total });
              }}
            />
          </div>
          <div>
            <label htmlFor={idFor("res-done")} className="mb-1 block text-[12px] text-muted">
              Done so far
            </label>
            <Input
              id={idFor("res-done")}
              type="number"
              inputMode="numeric"
              min={0}
              max={value.resourceTotal ?? 10000}
              defaultValue={value.resourceDone}
              onBlur={(e) => {
                const next = Math.max(0, parseCount(e.target.value) ?? 0);
                if (next !== value.resourceDone) withUnit({ resourceDone: next });
              }}
            />
          </div>
        </div>
      </div>
    </fieldset>
  );
}

/** Class / Side project / Self-learning as one segmented control. */
export function KindPicker({
  value,
  onChange,
  labelledBy,
  compact = false,
}: {
  value: SubjectKind;
  onChange: (kind: SubjectKind) => void;
  labelledBy?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={`grid grid-cols-3 gap-1 rounded-xl bg-line/50 p-1 ${compact ? "text-[13px]" : ""}`}
    >
      {KIND_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`${segment(active)} ${compact ? "h-8 text-[13px]" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** One-line summary, e.g. "Class · Weak · 4h a week · exam 15 Dec 2026". */
export function describeSetup(subject: Editable): string {
  const parts: string[] = [KIND_LABEL[subject.kind]];
  if (subject.kind !== "PROJECT" && subject.confidence) {
    parts.push(CONFIDENCE.find((c) => c.value === subject.confidence)!.label);
  }
  if (subject.kind === "SELF_LEARNING") {
    const resource = resourceProgress(subject);
    if (resource) parts.push(resource.doneLabel);
    if (subject.practiceDaysPerWeek) {
      parts.push(subject.practiceDaysPerWeek === 7 ? "daily" : `${subject.practiceDaysPerWeek} days a week`);
    }
  }
  if (subject.weeklyGoalMinutes) parts.push(`${formatDuration(subject.weeklyGoalMinutes)} a week`);
  if (subject.examDate && subject.kind !== "PROJECT") {
    parts.push(`${subject.kind === "CLASS" ? "exam" : "by"} ${formatDate(subject.examDate)}`);
  }
  return parts.join(" · ");
}
