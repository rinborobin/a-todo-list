import { boolean, check, date, index, integer, pgEnum, pgTable, text, time, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taskPriorityEnum = pgEnum("task_priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const taskStatusEnum = pgEnum("task_status", ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const availability = pgTable(
  "availability",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("availability_user_id_idx").on(table.userId),
    index("availability_user_day_idx").on(table.userId, table.dayOfWeek),
    check("availability_start_before_end", sql`${table.startTime} < ${table.endTime}`),
  ]
);

export const task = pgTable(
  "task",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
    status: taskStatusEnum("status").notNull().default("TODO"),
    estimatedMinutes: integer("estimated_minutes"),
    deadline: timestamp("deadline", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_user_id_idx").on(table.userId),
    index("task_deadline_idx").on(table.deadline),
    index("task_status_idx").on(table.status),
  ]
);

export const scheduleItemStatusEnum = pgEnum("schedule_item_status", [
  "SCHEDULED",
  "COMPLETED",
  "SKIPPED",
]);

export const dailyPlan = pgTable(
  "daily_plan",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("daily_plan_user_id_idx").on(table.userId),
    index("daily_plan_user_date_idx").on(table.userId, table.date),
  ]
);

export const scheduleItem = pgTable(
  "schedule_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    dailyPlanId: text("daily_plan_id")
      .notNull()
      .references(() => dailyPlan.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => task.id, { onDelete: "set null" }),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    status: scheduleItemStatusEnum("status").notNull().default("SCHEDULED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("schedule_item_plan_idx").on(table.dailyPlanId),
    index("schedule_item_task_idx").on(table.taskId),
    check("schedule_item_start_before_end", sql`${table.startTime} < ${table.endTime}`),
  ]
);

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Task = typeof task.$inferSelect;
export type NewTask = typeof task.$inferInsert;
export type TaskPriority = (typeof taskPriorityEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];

export type Availability = typeof availability.$inferSelect;
export type NewAvailability = typeof availability.$inferInsert;
export type DayOfWeek = (typeof dayOfWeekEnum.enumValues)[number];

export type DailyPlan = typeof dailyPlan.$inferSelect;
export type NewDailyPlan = typeof dailyPlan.$inferInsert;
export type ScheduleItem = typeof scheduleItem.$inferSelect;
export type NewScheduleItem = typeof scheduleItem.$inferInsert;
export type ScheduleItemStatus = (typeof scheduleItemStatusEnum.enumValues)[number];


