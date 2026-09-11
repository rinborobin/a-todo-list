"use client";

import type { Availability, DayOfWeek } from "@/db/schema";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { AvailabilityBlock } from "./availability-block";

interface AvailabilityDayProps {
  label: string;
  dayOfWeek: DayOfWeek;
  blocks: Availability[];
  onAdd: (dayOfWeek: DayOfWeek) => void;
  onEdit: (block: Availability) => void;
  onDelete: (id: string) => void;
  onClearDay: (dayOfWeek: DayOfWeek) => void;
}

export function AvailabilityDay({
  label,
  dayOfWeek,
  blocks,
  onAdd,
  onEdit,
  onDelete,
  onClearDay,
}: AvailabilityDayProps) {
  const isAvailable = blocks.length > 0;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</h3>
          <span
            className={`text-xs ${
              isAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {isAvailable ? "Available" : "Unavailable"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAdd(dayOfWeek)}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add block
          </button>
          {isAvailable && (
            <button
              type="button"
              onClick={() => onClearDay(dayOfWeek)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {isAvailable ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {blocks.map((block) => (
            <AvailabilityBlock key={block.id} block={block} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No availability set.</p>
      )}
    </div>
  );
}
