"use client";

import type { Availability } from "@/db/schema";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";

interface AvailabilityBlockProps {
  block: Availability;
  onEdit: (block: Availability) => void;
  onDelete: (id: string) => void;
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export function AvailabilityBlock({ block, onEdit, onDelete }: AvailabilityBlockProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {normalizeTime(block.startTime)} – {normalizeTime(block.endTime)}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(block)}
          aria-label="Edit block"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(block.id)}
          aria-label="Delete block"
          className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
