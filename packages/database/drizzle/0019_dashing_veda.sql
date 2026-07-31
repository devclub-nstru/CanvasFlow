DROP INDEX "form_submissions_form_visitor_idx";--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "require_sign_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "collect_respondent_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "one_response_per_respondent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "allowed_email_domains" jsonb;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "thank_you_message" text;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "respondent_user_id" text;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "respondent_email" varchar(255);--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_respondent_user_id_users_id_fk" FOREIGN KEY ("respondent_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_submissions_form_respondent_idx" ON "form_submissions" USING btree ("form_id","respondent_user_id");