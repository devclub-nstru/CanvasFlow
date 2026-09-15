ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" varchar(300);