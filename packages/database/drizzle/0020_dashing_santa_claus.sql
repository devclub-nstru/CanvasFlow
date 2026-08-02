CREATE TYPE "public"."upload_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "form_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"form_field_id" uuid NOT NULL,
	"submission_id" uuid,
	"claim_token" varchar(64) NOT NULL,
	"status" "upload_status" DEFAULT 'pending' NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(127) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"stored_path" text,
	"cloudinary_public_id" varchar(512),
	"cloudinary_url" text,
	"cloudinary_resource_type" varchar(32),
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_form_field_id_form_fields_id_fk" FOREIGN KEY ("form_field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_uploads_form_field_idx" ON "form_uploads" USING btree ("form_id","form_field_id");--> statement-breakpoint
CREATE INDEX "form_uploads_submission_idx" ON "form_uploads" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "form_uploads_status_created_idx" ON "form_uploads" USING btree ("status","created_at");