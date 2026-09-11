"use client";

import { useState } from "react";
import { updateScheduleItemStatusAction } from "@/actions/planner";
import type { PlanWithItems } from "@/actions/planner";
import { CheckIcon, ClockIcon } from "@/components/ui/icons";

interface ScheduleItemRowProps {
  item: PlanWithItems["items"][number];
  timezone: string;
}

export function ScheduleItemRow({ item, timezone }: ScheduleItemRowProps) {
  const [status, setStatus] = useState(item.status);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus: typeof status) => {
    if (newStatus === status) return;
    setIsUpdating(true);
    const result = await updateScheduleItemStatusAction(item.id, { status: newStatus });
    setIsUpdating(false);

    if (result.success) {
      setStatus(newStatus);
    }
  };

  const startTime = formatTime(item.startTime, timezone);
  const endTime = formatTime(item.endTime, timezone);
  const durationMinutes = Math.round(
    (item.endTime.getTime() - item.startTime.getTime()) / 60_000
  );

  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3">
      <div className="mt-0.5">
        {status === "COMPLETED" ? (
          <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <ClockIcon className="h-4 w-4 text-zinc-400" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {item.task?.title ?? "Untitled task"}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {startTime} – {endTime} ({durationMinutes} min)
        </p>
      </div>

      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value as typeof status)}
        disabled={isUpdating}
        className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer"
      >
        <option value="SCHEDULED">Scheduled</option>
        <option value="COMPLETED">Completed</option>
        <option value="SKIPPED">Skipped</option>
      </select>
    </div>
  );
}

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
