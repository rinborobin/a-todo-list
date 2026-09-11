"use client";

import { useMemo, useState } from "react";
import type { Availability, DayOfWeek } from "@/db/schema";
import {
  createAvailabilityBlockAction,
  updateAvailabilityBlockAction,
  deleteAvailabilityBlockAction,
  clearAvailabilityForDayAction,
  updateUserTimezoneAction,
} from "@/actions/availability";
import { dayOrder, type CreateAvailabilityInput, type UpdateAvailabilityInput } from "@/lib/validations/availability";
import { AvailabilityDay } from "./availability-day";
import { AvailabilityFormDialog } from "./availability-form-dialog";
import { TimezoneSelector } from "./timezone-selector";

interface AvailabilityManagerProps {
  initialBlocks: Availability[];
  initialTimezone: string;
}

const dayLabels: Record<DayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export function AvailabilityManager({ initialBlocks, initialTimezone }: AvailabilityManagerProps) {
  const [blocks, setBlocks] = useState<Availability[]>(initialBlocks);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [isUpdatingTimezone, setIsUpdatingTimezone] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Availability | null>(null);
  const [defaultDay, setDefaultDay] = useState<DayOfWeek>("MONDAY");

  const [actionError, setActionError] = useState<string | null>(null);

  const groupedBlocks = useMemo(() => {
    const grouped: Record<DayOfWeek, Availability[]> = {
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
      SUNDAY: [],
    };
    for (const block of blocks) {
      grouped[block.dayOfWeek].push(block);
    }
    for (const day of dayOrder) {
      grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return grouped;
  }, [blocks]);

  const handleTimezoneChange = async (newTimezone: string) => {
    setTimezone(newTimezone);
    setActionError(null);
    setIsUpdatingTimezone(true);

    const res = await updateUserTimezoneAction({ timezone: newTimezone });
    setIsUpdatingTimezone(false);

    if (!res.success) {
      setActionError(res.error || "Failed to update timezone");
      setTimezone(initialTimezone);
    }
  };

  const handleOpenCreate = (dayOfWeek: DayOfWeek) => {
    setEditingBlock(null);
    setDefaultDay(dayOfWeek);
    setIsFormOpen(true);
    setActionError(null);
  };

  const handleOpenEdit = (block: Availability) => {
    setEditingBlock(block);
    setDefaultDay(block.dayOfWeek);
    setIsFormOpen(true);
    setActionError(null);
  };

  const handleSubmit = async (data: CreateAvailabilityInput | UpdateAvailabilityInput) => {
    setActionError(null);

    if (editingBlock) {
      const res = await updateAvailabilityBlockAction(editingBlock.id, data as UpdateAvailabilityInput);
      if (!res.success) {
        return {
          success: false,
          error: res.error || "Failed to update block",
          fieldErrors: res.fieldErrors,
        };
      }
      setBlocks((prev) =>
        prev.map((b) => (b.id === editingBlock.id ? res.data : b))
      );
      return { success: true };
    }

    const res = await createAvailabilityBlockAction(data as CreateAvailabilityInput);
    if (!res.success) {
      return {
        success: false,
        error: res.error || "Failed to create block",
        fieldErrors: res.fieldErrors,
      };
    }
    setBlocks((prev) => [...prev, res.data]);
    return { success: true };
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    const res = await deleteAvailabilityBlockAction(id);
    if (!res.success) {
      setActionError(res.error || "Failed to delete block");
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleClearDay = async (dayOfWeek: DayOfWeek) => {
    setActionError(null);
    const res = await clearAvailabilityForDayAction(dayOfWeek);
    if (!res.success) {
      setActionError(res.error || "Failed to clear day");
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.dayOfWeek !== dayOfWeek));
  };

  return (
    <div>
      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {actionError}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <TimezoneSelector value={timezone} onChange={handleTimezoneChange} disabled={isUpdatingTimezone} />
        {isUpdatingTimezone && <span className="text-xs text-zinc-500 dark:text-zinc-400">Saving...</span>}
      </div>

      <div className="space-y-4">
        {dayOrder.map((day) => (
          <AvailabilityDay
            key={day}
            dayOfWeek={day}
            label={dayLabels[day]}
            blocks={groupedBlocks[day]}
            onAdd={handleOpenCreate}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            onClearDay={handleClearDay}
          />
        ))}
      </div>

      {isFormOpen && (
        <AvailabilityFormDialog
          key={editingBlock?.id || "new"}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingBlock(null);
          }}
          onSubmit={handleSubmit}
          initialBlock={editingBlock}
          defaultDayOfWeek={defaultDay}
        />
      )}
    </div>
  );
}
