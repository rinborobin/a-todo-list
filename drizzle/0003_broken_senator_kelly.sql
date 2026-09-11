CREATE TYPE "public"."schedule_item_status" AS ENUM('SCHEDULED', 'COMPLETED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "daily_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_item" (
	"id" text PRIMARY KEY NOT NULL,
	"daily_plan_id" text NOT NULL,
	"task_id" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "schedule_item_status" DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_item_start_before_end" CHECK ("schedule_item"."start_time" < "schedule_item"."end_time")
);
--> statement-breakpoint
ALTER TABLE "daily_plan" ADD CONSTRAINT "daily_plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_daily_plan_id_daily_plan_id_fk" FOREIGN KEY ("daily_plan_id") REFERENCES "public"."daily_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_plan_user_id_idx" ON "daily_plan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_plan_user_date_idx" ON "daily_plan" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "schedule_item_plan_idx" ON "schedule_item" USING btree ("daily_plan_id");--> statement-breakpoint
CREATE INDEX "schedule_item_task_idx" ON "schedule_item" USING btree ("task_id");