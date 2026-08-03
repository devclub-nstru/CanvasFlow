CREATE TABLE "form_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"values" jsonb NOT NULL,
	"page_path" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_drafts_form_id_user_id_unique" UNIQUE("form_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "form_drafts" ADD CONSTRAINT "form_drafts_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_drafts" ADD CONSTRAINT "form_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_drafts_user_form_idx" ON "form_drafts" USING btree ("user_id","form_id");