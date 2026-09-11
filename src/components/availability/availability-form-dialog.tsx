"use client";

import { useState } from "react";
import type { Availability, DayOfWeek } from "@/db/schema";
import { CloseIcon } from "@/components/ui/icons";
import { dayOrder, type CreateAvailabilityInput, type UpdateAvailabilityInput } from "@/lib/validations/availability";

interface AvailabilityFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAvailabilityInput | UpdateAvailabilityInput) => Promise<{
    success: boolean;
    error?: string;
    fieldErrors?: Record<string, string[] | undefined>;
  }>;
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

function normalizeTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export function AvailabilityFormDialog({
  isOpen,
  onClose,
  onSubmit,
  initialBlock,
  defaultDayOfWeek,
}: AvailabilityFormDialogProps) {
  const isEditing = !!initialBlock;

  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(
    initialBlock?.dayOfWeek ?? defaultDayOfWeek ?? "MONDAY"
  );
  const [startTime, setStartTime] = useState(normalizeTime(initialBlock?.startTime) ?? "09:00");
  const [endTime, setEndTime] = useState(normalizeTime(initialBlock?.endTime) ?? "17:00");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const payload = isEditing
      ? { dayOfWeek, startTime, endTime }
      : { dayOfWeek, startTime, endTime };

    setIsSubmitting(true);
    try {
      const res = await onSubmit(payload);
      if (!res.success) {
        setError(res.error || "Failed to save availability");
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save availability");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-dialog-title"
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 id="availability-dialog-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {isEditing ? "Edit Availability" : "Add Availability"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="availability-day"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Day
            </label>
            <select
              id="availability-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
              disabled={isEditing}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {dayOrder.map((day) => (
                <option key={day} value={day}>
                  {dayLabels[day]}
                </option>
              ))}
            </select>
            {fieldErrors.dayOfWeek && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.dayOfWeek[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="availability-start"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Start
              </label>
              <input
                id="availability-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {fieldErrors.startTime && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.startTime[0]}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="availability-end"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                End
              </label>
              <input
                id="availability-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {fieldErrors.endTime && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.endTime[0]}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add Block"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
