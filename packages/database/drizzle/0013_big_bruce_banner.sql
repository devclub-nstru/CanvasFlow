CREATE TYPE "public"."logic_action" AS ENUM('JUMP_TO_FIELD', 'JUMP_TO_SEGMENT', 'SUBMIT');--> statement-breakpoint
CREATE TYPE "public"."logic_operator" AS ENUM('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'GREATER_THAN', 'LESS_THAN', 'IS_EMPTY', 'IS_NOT_EMPTY');--> statement-breakpoint
CREATE TABLE "form_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"index" numeric NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_segments_form_id_index_unique" UNIQUE("form_id","index")
);
--> statement-breakpoint
CREATE TABLE "form_logic_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"operator" "logic_operator" NOT NULL,
	"value" jsonb,
	"action" "logic_action" NOT NULL,
	"target_field_id" uuid,
	"target_segment_id" uuid,
	"index" numeric NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_logic_rules_target_matches_action" CHECK ((
          ("form_logic_rules"."action" = 'JUMP_TO_FIELD' AND "form_logic_rules"."target_field_id" IS NOT NULL AND "form_logic_rules"."target_segment_id" IS NULL)
          OR ("form_logic_rules"."action" = 'JUMP_TO_SEGMENT' AND "form_logic_rules"."target_segment_id" IS NOT NULL AND "form_logic_rules"."target_field_id" IS NULL)
          OR ("form_logic_rules"."action" = 'SUBMIT' AND "form_logic_rules"."target_field_id" IS NULL AND "form_logic_rules"."target_segment_id" IS NULL)
        )),
	CONSTRAINT "form_logic_rules_value_matches_operator" CHECK ((
          ("form_logic_rules"."operator" IN ('IS_EMPTY', 'IS_NOT_EMPTY') AND "form_logic_rules"."value" IS NULL)
          OR ("form_logic_rules"."operator" NOT IN ('IS_EMPTY', 'IS_NOT_EMPTY') AND "form_logic_rules"."value" IS NOT NULL)
        )),
	CONSTRAINT "form_logic_rules_no_self_jump" CHECK ("form_logic_rules"."target_field_id" IS NULL OR "form_logic_rules"."target_field_id" <> "form_logic_rules"."field_id")
);
--> statement-breakpoint
ALTER TABLE "form_fields" ADD COLUMN "segment_id" uuid;--> statement-breakpoint
ALTER TABLE "form_segments" ADD CONSTRAINT "form_segments_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_field_id_form_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_target_field_id_form_fields_id_fk" FOREIGN KEY ("target_field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_target_segment_id_form_segments_id_fk" FOREIGN KEY ("target_segment_id") REFERENCES "public"."form_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_segments_form_idx" ON "form_segments" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_logic_rules_form_idx" ON "form_logic_rules" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_logic_rules_field_idx" ON "form_logic_rules" USING btree ("field_id","index");--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_segment_id_form_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."form_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_fields_segment_idx" ON "form_fields" USING btree ("segment_id","index");