"use client";

import type { Availability, DayOfWeek } from "@/db/schema";
import { PlusIcon } from "@/components/ui/icons";

interface AvailabilityDayProps {
  label: string;
  dayOfWeek: DayOfWeek;
  blocks: Availability[];
  onAdd: (dayOfWeek: DayOfWeek) => void;
  onEdit: (block: Availability) => void;
}

const hhmm = (value: string) => value.slice(0, 5);

function totalMinutes(blocks: Availability[]) {
  return blocks.reduce((sum, b) => {
    const [sh, sm] = hhmm(b.startTime).split(":").map(Number);
    const [eh, em] = hhmm(b.endTime).split(":").map(Number);
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
}

export function AvailabilityDay({ label, dayOfWeek, blocks, onAdd, onEdit }: AvailabilityDayProps) {
  const minutes = totalMinutes(blocks);

  return (
    <li className="flex items-start gap-3 py-3">
      <div className="w-24 shrink-0 pt-1.5 sm:w-28">
        <p className="text-[15px] font-medium">{label}</p>
        <p className="text-xs text-muted">
          {minutes > 0 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""} free` : "Not free"}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {blocks.map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={() => onEdit(block)}
            aria-label={`Edit ${label} ${hhmm(block.startTime)} to ${hhmm(block.endTime)}`}
            className="tabular h-9 rounded-lg bg-sheet px-3 text-sm shadow-[0_0_0_1px_var(--line-strong)] transition-colors hover:shadow-[0_0_0_1px_var(--ink)]"
          >
            {hhmm(block.startTime)}–{hhmm(block.endTime)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onAdd(dayOfWeek)}
          aria-label={`Add free time on ${label}`}
          className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm text-muted hover:bg-line/60 hover:text-ink"
        >
          <PlusIcon className="h-4 w-4" />
          {blocks.length === 0 && "Add"}
        </button>
      </div>
    </li>
  );
}
