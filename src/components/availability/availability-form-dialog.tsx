"use client";

import { useState } from "react";
import type { Availability, DayOfWeek } from "@/db/schema";
import { dayOrder, type CreateAvailabilityInput, type UpdateAvailabilityInput } from "@/lib/validations/availability";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorNote, Field, Input, Select } from "@/components/ui/field";

interface AvailabilityFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAvailabilityInput | UpdateAvailabilityInput) => Promise<{
    success: boolean;
    error?: string;
    fieldErrors?: Record<string, string[] | undefined>;
  }>;
  onDelete?: (id: string) => Promise<void>;
  initialBlock?: Availability | null;
  defaultDayOfWeek?: DayOfWeek;
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

const presets = [
  { label: "Morning", start: "08:00", end: "12:00" },
  { label: "Afternoon", start: "13:00", end: "17:00" },
  { label: "Evening", start: "19:00", end: "22:00" },
];

export function AvailabilityFormDialog({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initialBlock,
  defaultDayOfWeek,
}: AvailabilityFormDialogProps) {
  const isEditing = !!initialBlock;

  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initialBlock?.dayOfWeek ?? defaultDayOfWeek ?? "MONDAY");
  const [startTime, setStartTime] = useState(initialBlock?.startTime.slice(0, 5) ?? "19:00");
  const [endTime, setEndTime] = useState(initialBlock?.endTime.slice(0, 5) ?? "22:00");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const res = await onSubmit({ dayOfWeek, startTime, endTime });
      if (!res.success) {
        setError(res.error || "Could not save");
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialBlock || !onDelete) return;
    setIsSubmitting(true);
    await onDelete(initialBlock.id);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? "Edit free time" : "Add free time"}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <ErrorNote>{error}</ErrorNote>}

        <Field label="Day" htmlFor="availability-day" error={fieldErrors.dayOfWeek?.[0]}>
          <Select
            id="availability-day"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
            disabled={isEditing}
          >
            {dayOrder.map((day) => (
              <option key={day} value={day}>
                {dayLabels[day]}
              </option>
            ))}
          </Select>
        </Field>

        {!isEditing && (
          <div className="flex gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setStartTime(p.start);
                  setEndTime(p.end);
                }}
                className={`h-9 flex-1 rounded-lg text-[13px] transition-colors ${
                  startTime === p.start && endTime === p.end ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:bg-line"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="From" htmlFor="availability-start" error={fieldErrors.startTime?.[0]}>
            <Input id="availability-start" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Until" htmlFor="availability-end" error={fieldErrors.endTime?.[0]}>
            <Input id="availability-end" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
          {isEditing && onDelete && (
            <Button variant="ghost" onClick={handleDelete} disabled={isSubmitting} className="text-danger hover:text-danger sm:mr-auto">
              Remove
            </Button>
          )}
          <Button onClick={onClose} disabled={isSubmitting} className={isEditing ? "" : "sm:ml-auto"}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEditing ? "Save" : "Add"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
