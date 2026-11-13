import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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

// Better Auth rate limiting, stored in the database so limits hold across
// serverless instances (in-memory counters reset per instance on Vercel).
export const rateLimit = pgTable("rate_limit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
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

export const subjectConfidenceEnum = pgEnum("subject_confidence", ["WEAK", "OK", "STRONG"]);
/** What a subject is: a class, a side project or something learned on your own. */
export const subjectKindEnum = pgEnum("subject_kind", ["CLASS", "PROJECT", "SELF_LEARNING"]);

export const subject = pgTable(
  "subject",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: subjectKindEnum("kind").notNull().default("CLASS"),
    // Set during setup; seeds suggestions before there is study history.
    confidence: subjectConfidenceEnum("confidence"),
    // Exam date for a class, target date for self-learning.
    examDate: date("exam_date"),
    weeklyGoalMinutes: integer("weekly_goal_minutes"),
    // Self-learning: how many days a week to practise, and the book or course being worked through.
    practiceDaysPerWeek: integer("practice_days_per_week"),
    resourceName: text("resource_name"),
    resourceUnit: text("resource_unit"),
    resourceTotal: integer("resource_total"),
    resourceDone: integer("resource_done").notNull().default(0),
    // Subjects are archived rather than deleted so study history keeps its label.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("subject_user_name_idx").on(table.userId, sql`lower(${table.name})`),
    check(
      "subject_weekly_goal_range",
      sql`${table.weeklyGoalMinutes} is null or (${table.weeklyGoalMinutes} >= 0 and ${table.weeklyGoalMinutes} <= 2400)`
    ),
    check(
      "subject_practice_days_range",
      sql`${table.practiceDaysPerWeek} is null or (${table.practiceDaysPerWeek} >= 1 and ${table.practiceDaysPerWeek} <= 7)`
    ),
    check(
      "subject_resource_range",
      sql`${table.resourceDone} >= 0 and (${table.resourceTotal} is null or (${table.resourceTotal} >= 1 and ${table.resourceTotal} <= 10000 and ${table.resourceDone} <= ${table.resourceTotal}))`
    ),
  ]
);

/** A part of a subject ("Limits" in Calculus); has its own review schedule. */
export const topic = pgTable(
  "topic",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("topic_user_idx").on(table.userId),
    uniqueIndex("topic_subject_name_idx").on(table.subjectId, sql`lower(${table.name})`),
  ]
);

/** A step of a side project ("MVP", "Launch"); tasks can belong to one. */
export const milestone = pgTable(
  "milestone",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetDate: date("target_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("milestone_user_idx").on(table.userId), index("milestone_subject_idx").on(table.subjectId)]
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
    subjectId: text("subject_id").references(() => subject.id, { onDelete: "set null" }),
    milestoneId: text("milestone_id").references(() => milestone.id, { onDelete: "set null" }),
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
    aiGenerated: boolean("ai_generated").notNull().default(false),
    aiNotes: text("ai_notes"),
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

export const studySourceEnum = pgEnum("study_source", ["BLOCK", "TIMER", "MANUAL"]);
export const studyRatingEnum = pgEnum("study_rating", ["STRUGGLED", "OK", "GOT_IT"]);

export const studySession = pgTable(
  "study_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").references(() => subject.id, { onDelete: "set null" }),
    taskId: text("task_id").references(() => task.id, { onDelete: "set null" }),
    // Set for sessions logged by ticking a planned block; unique so a block logs once.
    scheduleItemId: text("schedule_item_id").references(() => scheduleItem.id, { onDelete: "set null" }),
    topicId: text("topic_id").references(() => topic.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    // Null while a timer is running.
    endedAt: timestamp("ended_at", { withTimezone: true }),
    minutes: integer("minutes").notNull().default(0),
    // Goal length for a timer session; drives the "time left" on the focus screen.
    plannedMinutes: integer("planned_minutes"),
    source: studySourceEnum("source").notNull(),
    rating: studyRatingEnum("rating"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("study_session_user_started_idx").on(table.userId, table.startedAt),
    uniqueIndex("study_session_schedule_item_idx").on(table.scheduleItemId),
    // At most one running timer per user.
    uniqueIndex("study_session_running_idx").on(table.userId).where(sql`${table.endedAt} is null`),
    check("study_session_minutes_range", sql`${table.minutes} >= 0 and ${table.minutes} <= 1440`),
    check(
      "study_session_planned_range",
      sql`${table.plannedMinutes} is null or (${table.plannedMinutes} >= 5 and ${table.plannedMinutes} <= 480)`
    ),
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



export type Subject = typeof subject.$inferSelect;
export type StudySession = typeof studySession.$inferSelect;
export type StudySource = (typeof studySourceEnum.enumValues)[number];
export type StudyRating = (typeof studyRatingEnum.enumValues)[number];
export type Topic = typeof topic.$inferSelect;
export type SubjectConfidence = (typeof subjectConfidenceEnum.enumValues)[number];
export type SubjectKind = (typeof subjectKindEnum.enumValues)[number];
export type Milestone = typeof milestone.$inferSelect;
