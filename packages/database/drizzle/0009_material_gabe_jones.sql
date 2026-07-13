CREATE TYPE "public"."collaborator_role" AS ENUM('viewer', 'editor');--> statement-breakpoint
CREATE TABLE "form_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "collaborator_role" NOT NULL,
	"added_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_collaborators" ADD CONSTRAINT "form_collaborators_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_collaborators" ADD CONSTRAINT "form_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_collaborators" ADD CONSTRAINT "form_collaborators_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_collaborators_form_idx" ON "form_collaborators" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_collaborators_user_idx" ON "form_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_collaborators_form_user_uniq_idx" ON "form_collaborators" USING btree ("form_id","user_id");