"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generatePlanAction,
  generatePlanWithAIAction,
  type PlanWithItems,
  type TaskProposalResult,
} from "@/actions/planner";
import { addDaysToDateKey, getDatesInRange } from "@/lib/scheduling/timezone";
import { formatDayHeading } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { DayRail } from "./day-rail";
import { ProposalForm } from "./proposal-form";
import { ProposalView } from "./proposal-view";

interface WeekViewProps {
  plans: PlanWithItems[];
  loadError: string | null;
  timezone: string;
  today: string;
  startDate: string;
  endDate: string;
  now: Date;
}

function formatRange(start: string, end: string) {
  const fmt = (key: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(new Date(`${key}T12:00:00Z`));
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${fmt(start, { day: "numeric" })}–${fmt(end, { day: "numeric", month: "long" })}`
    : `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short" })}`;
}

export function WeekView({ plans, loadError, timezone, today, startDate, endDate, now }: WeekViewProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"plain" | "ai" | null>(null);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [proposal, setProposal] = useState<{ proposal: TaskProposalResult; startDate: string; endDate: string } | null>(
    null
  );

  const itemsByDate = new Map<string, PlanWithItems["items"]>();
  for (const { plan, items } of plans) {
    itemsByDate.set(plan.date, [...(itemsByDate.get(plan.date) ?? []), ...items]);
  }
  const aiNotes = plans.find((p) => p.plan.aiNotes)?.plan.aiNotes ?? null;
  const isCurrentWeek = startDate === today;

  const plan = (mode: "plain" | "ai") => {
    setPending(mode);
    setMessage(null);
    startTransition(async () => {
      const action = mode === "ai" ? generatePlanWithAIAction : generatePlanAction;
      const result = await action({ startDate, endDate });
      setPending(null);
      if (!result.success) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const { scheduled, unscheduled } = result.data;
      const parts = [`${scheduled.length} planned`];
      if (unscheduled.length > 0) parts.push(`${unscheduled.length} could not fit`);
      if (mode === "ai" && !result.data.aiGenerated) parts.push("AI was unavailable, used the standard order");
      setMessage({ tone: "info", text: parts.join(" · ") });
      router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 lg:px-10 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{isCurrentWeek ? "Next 7 days" : "Week of"}</p>
          <h1 className="font-serif text-[34px] leading-tight lg:text-[40px]">{formatRange(startDate, endDate)}</h1>
        </div>
        <nav aria-label="Change week" className="mb-1 flex items-center gap-1">
          <Link
            href={`/week?start=${addDaysToDateKey(startDate, -7)}`}
            aria-label="Previous week"
            className="rounded-lg p-2 text-muted hover:bg-line/60 hover:text-ink"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          {!isCurrentWeek && (
            <Link href="/week" className="rounded-lg px-2 py-1.5 text-sm text-muted hover:text-ink">
              Today
            </Link>
          )}
          <Link
            href={`/week?start=${addDaysToDateKey(startDate, 7)}`}
            aria-label="Next week"
            className="rounded-lg p-2 text-muted hover:bg-line/60 hover:text-ink"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </Link>
        </nav>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => plan("plain")} disabled={pending !== null}>
          {pending === "plain" ? "Planning…" : "Plan these 7 days"}
        </Button>
        <Button onClick={() => plan("ai")} disabled={pending !== null}>
          {pending === "ai" ? "Asking AI…" : "Plan with AI"}
        </Button>
        {message && (
          <p className={`basis-full text-sm sm:basis-auto sm:pl-2 ${message.tone === "error" ? "text-danger" : "text-muted"}`}>
            {message.text}
          </p>
        )}
      </div>

      {loadError && <p className="mt-4 text-sm text-danger">{loadError}</p>}
      {aiNotes && <p className="mt-5 max-w-2xl font-serif text-[15px] italic text-ink-soft">{aiNotes}</p>}

      <div className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
        {getDatesInRange(startDate, endDate).map((dateKey) => {
          const items = itemsByDate.get(dateKey) ?? [];
          const heading = formatDayHeading(dateKey);
          const isToday = dateKey === today;
          const isPast = dateKey < today;
          return (
            <section key={dateKey} aria-label={heading.short} className={isPast ? "opacity-60" : ""}>
              <h2 className="mb-3 flex items-baseline gap-2">
                <span className="font-serif text-xl">{heading.weekday}</span>
                <span className="text-sm text-muted">{heading.day}</span>
                {isToday && <span className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Today</span>}
              </h2>
              {items.length > 0 ? (
                <DayRail items={items} timezone={timezone} now={now} live={isToday} />
              ) : (
                <p className="border-l border-line pl-6 text-sm text-faint">Nothing planned</p>
              )}
            </section>
          );
        })}
      </div>

      <details className="group mt-14 border-t border-line pt-6" open={proposal !== null}>
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span>
            <span className="block font-serif text-xl">Ask AI to suggest tasks</span>
            <span className="text-sm text-muted">
              Describe what you need to get done. You review the suggestions before anything is saved.
            </span>
          </span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-6 max-w-3xl">
          {proposal ? (
            <ProposalView
              proposal={proposal.proposal}
              startDate={proposal.startDate}
              endDate={proposal.endDate}
              onCancel={() => setProposal(null)}
            />
          ) : (
            <ProposalForm onProposal={(p, s, e) => setProposal({ proposal: p, startDate: s, endDate: e })} />
          )}
        </div>
      </details>
    </main>
  );
}
