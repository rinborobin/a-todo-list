"use client";

import { useMemo, useState } from "react";
import type { Availability, DayOfWeek } from "@/db/schema";
import {
  createAvailabilityBlockAction,
  updateAvailabilityBlockAction,
  deleteAvailabilityBlockAction,
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

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

export function AvailabilityManager({ initialBlocks, initialTimezone }: AvailabilityManagerProps) {
  const [blocks, setBlocks] = useState<Availability[]>(initialBlocks);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [timezoneStatus, setTimezoneStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Availability | null>(null);
  const [defaultDay, setDefaultDay] = useState<DayOfWeek>("MONDAY");
  const [actionError, setActionError] = useState<string | null>(null);

  const groupedBlocks = useMemo(() => {
    const grouped = Object.fromEntries(dayOrder.map((day) => [day, [] as Availability[]])) as Record<
      DayOfWeek,
      Availability[]
    >;
    for (const block of blocks) grouped[block.dayOfWeek].push(block);
    for (const day of dayOrder) grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return grouped;
  }, [blocks]);

  const handleTimezoneChange = async (newTimezone: string) => {
    const previous = timezone;
    setTimezone(newTimezone);
    setActionError(null);
    setTimezoneStatus("saving");

    const res = await updateUserTimezoneAction({ timezone: newTimezone });
    if (!res.success) {
      setActionError(res.error || "Could not change the time zone");
      setTimezone(previous);
      setTimezoneStatus("idle");
      return;
    }
    setTimezoneStatus("saved");
  };

  const handleSubmit = async (data: CreateAvailabilityInput | UpdateAvailabilityInput) => {
    setActionError(null);

    if (editingBlock) {
      const res = await updateAvailabilityBlockAction(editingBlock.id, data as UpdateAvailabilityInput);
      if (!res.success) return { success: false, error: res.error, fieldErrors: res.fieldErrors };
      setBlocks((prev) => prev.map((b) => (b.id === editingBlock.id ? res.data : b)));
      return { success: true };
    }

    const res = await createAvailabilityBlockAction(data as CreateAvailabilityInput);
    if (!res.success) return { success: false, error: res.error, fieldErrors: res.fieldErrors };
    setBlocks((prev) => [...prev, res.data]);
    return { success: true };
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    const res = await deleteAvailabilityBlockAction(id);
    if (!res.success) {
      setActionError(res.error || "Could not remove that block");
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-10">
      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      <section aria-labelledby="tz-heading">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="tz-heading" className={sectionTitle}>
            Time zone
          </h2>
          <span className="text-xs text-muted" aria-live="polite">
            {timezoneStatus === "saving" ? "Saving…" : timezoneStatus === "saved" ? "Saved" : ""}
          </span>
        </div>
        <TimezoneSelector value={timezone} onChange={handleTimezoneChange} disabled={timezoneStatus === "saving"} />
      </section>

      <section aria-labelledby="hours-heading">
        <h2 id="hours-heading" className={sectionTitle}>
          Free hours each week
        </h2>
        <p className="mt-1 text-sm text-muted">Tasks are only planned inside these times. Leave out your classes.</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {dayOrder.map((day) => (
            <AvailabilityDay
              key={day}
              dayOfWeek={day}
              label={dayLabels[day]}
              blocks={groupedBlocks[day]}
              onAdd={(d) => {
                setEditingBlock(null);
                setDefaultDay(d);
                setIsFormOpen(true);
              }}
              onEdit={(block) => {
                setEditingBlock(block);
                setDefaultDay(block.dayOfWeek);
                setIsFormOpen(true);
              }}
            />
          ))}
        </ul>
      </section>

      {isFormOpen && (
        <AvailabilityFormDialog
          key={editingBlock?.id || `new-${defaultDay}`}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingBlock(null);
          }}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          initialBlock={editingBlock}
          defaultDayOfWeek={defaultDay}
        />
      )}
    </div>
  );
}
