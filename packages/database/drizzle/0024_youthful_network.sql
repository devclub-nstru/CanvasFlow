CREATE TABLE "pending_signups" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_signups_email_uniq_idx" ON "pending_signups" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pending_signups_expires_at_idx" ON "pending_signups" USING btree ("expires_at");