CREATE TYPE "public"."reminder_kind" AS ENUM('MORNING', 'DUE_DAY', 'DUE_SOON', 'OVERDUE');--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ok_at" timestamp with time zone,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "reminder_kind" NOT NULL,
	"dedupe_key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_log_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "reminder_pref" (
	"user_id" text PRIMARY KEY NOT NULL,
	"morning_enabled" boolean DEFAULT true NOT NULL,
	"morning_time" time DEFAULT '07:30' NOT NULL,
	"deadline_enabled" boolean DEFAULT true NOT NULL,
	"overdue_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_pref" ADD CONSTRAINT "reminder_pref_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminder_log_sent_idx" ON "reminder_log" USING btree ("sent_at");