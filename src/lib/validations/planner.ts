import { z } from "zod";

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const generatePlanSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine(
    (data) => data.startDate <= data.endDate,
    {
      message: "Start date must be on or before end date",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffMs = end.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= 30;
    },
    {
      message: "Date range cannot exceed 30 days",
      path: ["endDate"],
    }
  );

export const updateScheduleItemStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "SKIPPED"]),
});

export type GeneratePlanInput = z.input<typeof generatePlanSchema>;
export type UpdateScheduleItemStatusInput = z.input<typeof updateScheduleItemStatusSchema>;
