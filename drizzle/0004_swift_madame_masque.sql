ALTER TABLE "daily_plan" ADD COLUMN "ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_plan" ADD COLUMN "ai_notes" text;