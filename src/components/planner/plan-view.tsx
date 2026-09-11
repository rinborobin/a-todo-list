import type { PlanWithItems } from "@/actions/planner";
import { ScheduleItemRow } from "./schedule-item-row";
import { CalendarIcon, InboxIcon, PlayIcon } from "@/components/ui/icons";

interface PlanViewProps {
  plans: PlanWithItems[];
  timezone: string;
}

export function PlanView({ plans, timezone }: PlanViewProps) {
  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
        <InboxIcon className="mx-auto h-8 w-8 text-zinc-400" />
        <h3 className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          No plans yet
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Select a date range and generate a plan to schedule your tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {plans.map((planWithItems) => (
        <div
          key={planWithItems.plan.id}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-zinc-500" />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {formatDate(planWithItems.plan.date, timezone)}
              </h2>
            </div>
            {planWithItems.plan.aiGenerated && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <PlayIcon className="h-3 w-3" />
                AI-assisted
              </span>
            )}
          </div>

          {planWithItems.plan.aiNotes && (
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {planWithItems.plan.aiNotes}
            </p>
          )}

          {planWithItems.items.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No tasks scheduled for this day.
            </p>
          ) : (
            <div className="space-y-2">
              {planWithItems.items
                .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                .map((item) => (
                  <ScheduleItemRow key={item.id} item={item} timezone={timezone} />
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatDate(dateString: string, timezone: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
