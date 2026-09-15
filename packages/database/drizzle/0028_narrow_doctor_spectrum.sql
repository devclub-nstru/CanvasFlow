CREATE TYPE "public"."admin_audit_action" AS ENUM('user.suspended', 'user.unsuspended', 'user.signed_out', 'user.password_reset', 'admin.granted', 'admin.revoked', 'signup.code_resent', 'signup.deleted');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"actor_email" varchar(255) NOT NULL,
	"action" "admin_audit_action" NOT NULL,
	"target_user_id" text,
	"target_label" varchar(255),
	"detail" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_target_idx" ON "admin_audit_log" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_actor_idx" ON "admin_audit_log" USING btree ("actor_id","created_at");