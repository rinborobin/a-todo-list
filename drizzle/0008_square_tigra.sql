CREATE TYPE "public"."subject_confidence" AS ENUM('WEAK', 'OK', 'STRONG');--> statement-breakpoint
CREATE TABLE "topic" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_session" ADD COLUMN "topic_id" text;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "confidence" "subject_confidence";--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "exam_date" date;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "weekly_goal_minutes" integer;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_user_idx" ON "topic" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_subject_name_idx" ON "topic" USING btree ("subject_id",lower("name"));--> statement-breakpoint
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_weekly_goal_range" CHECK ("subject"."weekly_goal_minutes" is null or ("subject"."weekly_goal_minutes" >= 0 and "subject"."weekly_goal_minutes" <= 2400));