import { z } from "zod";

export const DayOfWeek = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);
export type DayOfWeek = z.infer<typeof DayOfWeek>;

export const dayOrder: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

function isValidTime(value: string): boolean {
  return timeRegex.test(value);
}

export const timeStringSchema = z
  .string()
  .trim()
  .regex(timeRegex, "Time must be in HH:mm format");

// Lazy-load the supported timezone list only when needed.
function getSupportedTimezones(): Set<string> {
  try {
    return new Set(Intl.supportedValuesOf("timeZone"));
  } catch {
    return new Set(["UTC"]);
  }
}

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone is required")
  .refine((value) => getSupportedTimezones().has(value), {
    message: "Invalid timezone identifier",
  });

export const createAvailabilitySchema = z
  .object({
    dayOfWeek: DayOfWeek,
    startTime: timeStringSchema,
    endTime: timeStringSchema,
  })
  .refine((data) => isValidTime(data.startTime) && isValidTime(data.endTime), {
    message: "Invalid time format",
  })
  .refine(
    (data) => {
      if (!isValidTime(data.startTime) || !isValidTime(data.endTime)) return true;
      return data.startTime < data.endTime;
    },
    {
      message: "Start time must be before end time",
      path: ["endTime"],
    }
  );

export const updateAvailabilitySchema = z
  .object({
    dayOfWeek: DayOfWeek.optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true;
      if (!isValidTime(data.startTime) || !isValidTime(data.endTime)) return true;
      return data.startTime < data.endTime;
    },
    {
      message: "Start time must be before end time",
      path: ["endTime"],
    }
  );

export const updateTimezoneSchema = z.object({
  timezone: timezoneSchema,
});

export type CreateAvailabilityInput = z.input<typeof createAvailabilitySchema>;
export type UpdateAvailabilityInput = z.input<typeof updateAvailabilitySchema>;
export type UpdateTimezoneInput = z.input<typeof updateTimezoneSchema>;
