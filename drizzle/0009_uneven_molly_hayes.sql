CREATE TYPE "public"."subject_kind" AS ENUM('CLASS', 'PROJECT', 'SELF_LEARNING');--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"name" text NOT NULL,
	"target_date" date,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "kind" "subject_kind" DEFAULT 'CLASS' NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "practice_days_per_week" integer;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "resource_name" text;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "resource_unit" text;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "resource_total" integer;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "resource_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "milestone_id" text;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestone_user_idx" ON "milestone" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "milestone_subject_idx" ON "milestone" USING btree ("subject_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_milestone_id_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_practice_days_range" CHECK ("subject"."practice_days_per_week" is null or ("subject"."practice_days_per_week" >= 1 and "subject"."practice_days_per_week" <= 7));--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_resource_range" CHECK ("subject"."resource_done" >= 0 and ("subject"."resource_total" is null or ("subject"."resource_total" >= 1 and "subject"."resource_total" <= 10000 and "subject"."resource_done" <= "subject"."resource_total")));