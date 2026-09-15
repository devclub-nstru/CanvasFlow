ALTER TYPE "public"."feedback_status" ADD VALUE 'in_progress' BEFORE 'resolved';--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_assigned_created_idx" ON "feedback" USING btree ("assigned_to","created_at");