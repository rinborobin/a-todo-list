CREATE TYPE "public"."topic_origin" AS ENUM('LOGGED', 'OUTLINE', 'AI');--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN "origin" "topic_origin" DEFAULT 'LOGGED' NOT NULL;--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN "planned_on" date;--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN "reason" text;