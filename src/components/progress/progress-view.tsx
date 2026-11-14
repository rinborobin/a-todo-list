"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { askAiStudyNextAction, deleteStudySessionAction, type AiStudyNextResult } from "@/actions/study";
import type { StudySession } from "@/db/schema";
import type { StudyNextSuggestion } from "@/lib/study/next";
import { SOURCE_LABEL } from "@/lib/study/labels";
import { formatClock, formatDayHeading, formatDuration } from "@/lib/format";
import { toLocalDateKey } from "@/lib/scheduling/timezone";
import { StudyNow, type RunningTimer } from "@/components/study/study-now";
import type { PickerSubject } from "@/lib/study/picker";
import { RatingPicker } from "@/components/study/rating-picker";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { DailyStrip } from "./daily-strip";
import { LogStudyDialog } from "./log-study-dialog";
import { SubjectMeters, type SubjectMeterRow } from "./subject-meters";
import { LearnedSection } from "./learned-section";
import type { Learned } from "@/lib/study/learned";

interface ProgressViewProps {
  timezone: string;
  today: string;
  initialNow: Date;
  totalMinutes7d: number;
  days: { date: string; minutes: number }[];
  subjectRows: SubjectMeterRow[];
  sessions: StudySession[];
  subjectNames: Record<string, string>;
  /** Ids of side projects: their sessions are not rated. */
  projectIds: string[];
  taskTitles: Record<string, string>;
  activeSubjects: { id: string; name: string }[];
  topics: { id: string; name: string; subjectId: string }[];
  learned: Learned;
  suggestion: StudyNextSuggestion | null;
  /** Subjects with topics or tasks, for "Choose what to study". */
  pickerSubjects: PickerSubject[];
  running: RunningTimer | null;
}

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

export function ProgressView(props: ProgressViewProps) {
  const { timezone, today, initialNow, totalMinutes7d, days, subjectRows, sessions, subjectNames, taskTitles } = props;
  const [logOpen, setLogOpen] = useState(false);
  const [ai, setAi] = useState<AiStudyNextResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAsking, startAsking] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);

  const askAi = () => {
    setAiError(null);
    startAsking(async () => {
      const result = await askAiStudyNextAction();
      if (!result.success) {
        setAiError(result.error);
        return;
      }
      setAi(result.data);
    });
  };

  const remove = async (id: string) => {
    setDeleting(id);
    await deleteStudySessionAction(id);
    setDeleting(null);
  };

  const byDay = new Map<string, StudySession[]>();
  for (const s of sessions) {
    const key = toLocalDateKey(s.startedAt, timezone);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 pt-6 sm:px-8 lg:px-10 lg:pt-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Last 7 days</p>
          <h1 className="font-serif text-[34px] leading-tight lg:text-[40px]">
            {totalMinutes7d > 0 ? `${formatDuration(totalMinutes7d)} studied` : "No study logged yet"}
          </h1>
        </div>
        {props.activeSubjects.length > 0 && (
          <Button variant="primary" onClick={() => setLogOpen(true)} className="mb-1">
            <PlusIcon className="h-4 w-4" />
            Log study
          </Button>
        )}
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        <div className="min-w-0 space-y-10">
          <DailyStrip days={days} today={today} />

          <section aria-labelledby="subjects-heading">
            <h2 id="subjects-heading" className={`${sectionTitle} mb-2`}>
              Where the time went
            </h2>
            {subjectRows.length > 0 ? (
              <SubjectMeters rows={subjectRows} />
            ) : (
              <p className="text-sm text-muted">
                <Link href="/me" className="font-medium text-ink underline-offset-4 hover:underline">
                  Add your subjects
                </Link>{" "}
                first. Time is then counted per subject.
              </p>
            )}
          </section>

          <LearnedSection learned={props.learned} />

          <section aria-labelledby="sessions-heading">
            <h2 id="sessions-heading" className={`${sectionTitle} mb-2`}>
              Recent sessions
            </h2>
            {byDay.size === 0 ? (
              <p className="text-sm text-muted">
                Sessions appear here when you tick a planned block, run the timer, or log study.
              </p>
            ) : (
              <div className="space-y-6">
                {[...byDay].map(([day, list]) => (
                  <div key={day}>
                    <h3 className="mb-1 font-serif text-lg">
                      {day === today ? "Today" : formatDayHeading(day).short}
                    </h3>
                    <ul className="divide-y divide-line">
                      {list.map((s) => (
                        <li key={s.id} className="py-3">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px]">
                                <span className="font-medium">
                                  {s.subjectId ? (subjectNames[s.subjectId] ?? "Subject") : "No subject"}
                                </span>
                                {s.taskId && taskTitles[s.taskId] && (
                                  <span className="text-ink-soft"> · {taskTitles[s.taskId]}</span>
                                )}
                              </p>
                              <p className="text-[13px] text-muted">
                                {formatDuration(s.minutes)} · {SOURCE_LABEL[s.source]}
                                {s.source !== "MANUAL" && ` · ${formatClock(s.startedAt, timezone)}`}
                              </p>
                              {s.note && <p className="mt-1 text-[13px] text-ink-soft">{s.note}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => remove(s.id)}
                              disabled={deleting === s.id}
                              aria-label="Delete this session"
                              className="rounded-lg p-2 text-faint hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                          {!(s.subjectId && props.projectIds.includes(s.subjectId)) && (
                            <div className="mt-2">
                              <RatingPicker sessionId={s.id} value={s.rating} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="order-first space-y-4 lg:order-none" aria-label="What to do next">
          <StudyNow
            suggestion={ai?.suggestion ?? props.suggestion}
            running={props.running}
            subjects={props.pickerSubjects}
            initialNow={initialNow}
            timezone={timezone}
          />
          {props.activeSubjects.length > 0 && !props.running && (
            <div className="pl-4">
              {ai?.step && (
                <div className="rise mb-3 border-l-2 border-accent pl-3">
                  <p className="text-xs text-muted">What to do</p>
                  <p className="mt-0.5 text-[15px] leading-snug">{ai.step}</p>
                </div>
              )}
              {ai && (
                <p className="mb-2 text-[13px] text-muted">
                  {ai.source === "ai"
                    ? "Suggested by AI from your history, reviews, milestones and deadlines."
                    : "AI was unavailable, so this is the standard suggestion."}
                </p>
              )}
              <Button variant="ghost" size="sm" onClick={askAi} disabled={isAsking} className="-ml-3">
                {isAsking ? "Asking AI…" : ai ? "Ask AI again" : "Ask AI what to do next"}
              </Button>
              {aiError && <p className="mt-1 text-[13px] text-danger">{aiError}</p>}
            </div>
          )}
        </aside>
      </div>

      {logOpen && (
        <LogStudyDialog open={logOpen} onClose={() => setLogOpen(false)} subjects={props.activeSubjects} topics={props.topics} today={today} />
      )}
    </main>
  );
}
