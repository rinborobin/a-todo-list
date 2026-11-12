"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TodayData } from "@/actions/planner";
import type { Task } from "@/db/schema";
import { DayRail } from "@/components/planner/day-rail";
import { buttonClasses } from "@/components/ui/button";
import { ChevronRightIcon } from "@/components/ui/icons";
import { describeDue, formatDayHeading, formatDuration } from "@/lib/format";
import { QuickAdd } from "./quick-add";
import { ReplanButton } from "./replan-button";

interface TodayViewProps {
  data: TodayData;
  initialNow: Date;
}

/** Re-renders every minute so "in 40 min" and the now marker stay current. */
function useMinuteClock(initial: Date): Date {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

export function TodayView({ data, initialNow }: TodayViewProps) {
  const now = useMinuteClock(initialNow);
  const { timezone, today, items, deadlines, unplanned, hasAvailability } = data;
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const heading = formatDayHeading(today);
  const live = items.map((item) => ({ ...item, status: statuses[item.id] ?? item.status }));
  const counted = live.filter((item) => item.status !== "SKIPPED");
  const done = counted.filter((item) => item.status === "COMPLETED").length;
  const minutesLeft = counted
    .filter((item) => item.status === "SCHEDULED" && item.endTime > now)
    .reduce((sum, item) => sum + Math.round((item.endTime.getTime() - Math.max(item.startTime.getTime(), now.getTime())) / 60_000), 0);

  const deadlineNote = <Deadlines tasks={deadlines} now={now} timezone={timezone} />;
  const unplannedList = <Unplanned tasks={unplanned} now={now} />;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-28 pt-6 sm:px-8 lg:px-10 lg:pb-0 lg:pt-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{heading.weekday}</p>
          <h1 className="font-serif text-[34px] leading-tight lg:text-[40px]">{heading.day}</h1>
        </div>
        {counted.length > 0 && (
          <p className="pb-1.5 text-right text-xs leading-relaxed text-muted">
            <span className="font-semibold text-ink">
              {done} of {counted.length}
            </span>{" "}
            done
            {minutesLeft > 0 && (
              <>
                <br />
                {formatDuration(minutesLeft)} left
              </>
            )}
          </p>
        )}
      </header>

      <div className="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        <section aria-labelledby="plan-heading" className="min-w-0">
          <div className="mb-6 lg:hidden">{deadlineNote}</div>

          <div className="mb-3 flex items-center justify-between">
            <h2 id="plan-heading" className={sectionTitle}>
              Plan
            </h2>
            {hasAvailability && items.length > 0 && <ReplanButton />}
          </div>

          {!hasAvailability ? (
            <EmptyState
              text="Set the hours you are free each week first. Tasks are only planned inside them."
              action={
                <Link href="/me" className={buttonClasses("primary")}>
                  Set free hours
                </Link>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              text={
                unplanned.length > 0
                  ? "Nothing is planned for today yet."
                  : "Nothing planned. Add a task and it will be fitted into your free time."
              }
              action={unplanned.length > 0 ? <ReplanButton label="Plan my week" variant="primary" /> : null}
            />
          ) : (
            <DayRail
              items={items}
              timezone={timezone}
              now={now}
              live
              onStatusChange={(id, status) => setStatuses((prev) => ({ ...prev, [id]: status }))}
            />
          )}

          <div className="mt-10 lg:hidden">{unplannedList}</div>
        </section>

        <aside className="flex flex-col gap-10">
          <QuickAdd timezone={timezone} />
          <div className="hidden lg:block">{deadlineNote}</div>
          <div className="hidden lg:block">{unplannedList}</div>
        </aside>
      </div>
    </main>
  );
}

function EmptyState({ text, action }: { text: string; action: React.ReactNode }) {
  return (
    <div className="border-l border-line-strong py-2 pl-6">
      <p className="max-w-sm font-serif text-lg leading-snug text-ink-soft">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Deadlines({ tasks, now, timezone }: { tasks: Task[]; now: Date; timezone: string }) {
  if (tasks.length === 0) {
    return <p className="hidden text-sm text-muted lg:block">No deadlines in the next 7 days.</p>;
  }

  return (
    <section aria-labelledby="due-heading" className="border-l-2 border-accent pl-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="due-heading" className={sectionTitle}>
          Due soon
        </h2>
        <Link href="/tasks" className="text-xs text-muted hover:text-ink">
          All tasks
        </Link>
      </div>
      <ul className="space-y-1.5">
        {tasks.slice(0, 4).map((task) => {
          const due = describeDue(task.deadline!, now, timezone);
          return (
            <li key={task.id} className="flex items-baseline justify-between gap-3 text-[15px]">
              <Link href={`/tasks/${task.id}`} className="min-w-0 truncate font-medium hover:underline">
                {task.title}
              </Link>
              <span
                className={`tabular shrink-0 text-[13px] ${
                  due.tone === "normal" ? "text-muted" : "font-medium text-accent"
                }`}
              >
                {due.label}
              </span>
            </li>
          );
        })}
      </ul>
      {tasks.length > 4 && <p className="mt-2 text-xs text-muted">and {tasks.length - 4} more</p>}
    </section>
  );
}

function reasonFor(task: Task, now: Date): string {
  if (!task.estimatedMinutes) return "Needs a time estimate";
  if (task.deadline && task.deadline < now) return "Deadline has passed";
  return "No free slot this week";
}

function Unplanned({ tasks, now }: { tasks: Task[]; now: Date }) {
  if (tasks.length === 0) return null;

  return (
    <section aria-labelledby="unplanned-heading">
      <h2 id="unplanned-heading" className={`${sectionTitle} mb-2`}>
        Not planned · {tasks.length}
      </h2>
      <ul className="divide-y divide-line">
        {tasks.slice(0, 5).map((task) => (
          <li key={task.id}>
            <Link href={`/tasks/${task.id}`} className="group flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] group-hover:underline">{task.title}</span>
                <span className="text-[13px] text-muted">{reasonFor(task, now)}</span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
