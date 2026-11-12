CREATE TYPE "public"."study_rating" AS ENUM('STRUGGLED', 'OK', 'GOT_IT');--> statement-breakpoint
CREATE TYPE "public"."study_source" AS ENUM('BLOCK', 'TIMER', 'MANUAL');--> statement-breakpoint
CREATE TABLE "study_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text,
	"task_id" text,
	"schedule_item_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"minutes" integer DEFAULT 0 NOT NULL,
	"source" "study_source" NOT NULL,
	"rating" "study_rating",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_session_minutes_range" CHECK ("study_session"."minutes" >= 0 and "study_session"."minutes" <= 1440)
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "subject_id" text;--> statement-breakpoint
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_schedule_item_id_schedule_item_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "public"."schedule_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_session_user_started_idx" ON "study_session" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "study_session_schedule_item_idx" ON "study_session" USING btree ("schedule_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_session_running_idx" ON "study_session" USING btree ("user_id") WHERE "study_session"."ended_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "subject_user_name_idx" ON "subject" USING btree ("user_id",lower("name"));--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;