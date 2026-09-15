ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp;--> statement-breakpoint
CREATE INDEX "users_last_seen_idx" ON "users" USING btree ("last_seen_at");