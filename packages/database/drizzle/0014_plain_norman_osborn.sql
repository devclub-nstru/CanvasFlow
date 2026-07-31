CREATE TYPE "public"."logic_match" AS ENUM('ALL', 'ANY');--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'CONTINUE';--> statement-breakpoint
ALTER TYPE "public"."logic_operator" ADD VALUE 'IS_ANY_OF';--> statement-breakpoint
ALTER TYPE "public"."logic_operator" ADD VALUE 'IS_NONE_OF';--> statement-breakpoint
ALTER TYPE "public"."logic_operator" ADD VALUE 'STARTS_WITH';--> statement-breakpoint
ALTER TYPE "public"."logic_operator" ADD VALUE 'ENDS_WITH';--> statement-breakpoint
CREATE TABLE "form_logic_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"operator" "logic_operator" NOT NULL,
	"value" jsonb,
	"index" numeric NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_logic_conditions_value_matches_operator" CHECK ((
          ("form_logic_conditions"."operator" IN ('IS_EMPTY', 'IS_NOT_EMPTY') AND "form_logic_conditions"."value" IS NULL)
          OR ("form_logic_conditions"."operator" NOT IN ('IS_EMPTY', 'IS_NOT_EMPTY') AND "form_logic_conditions"."value" IS NOT NULL)
        ))
);
--> statement-breakpoint
ALTER TABLE "form_logic_rules" DROP CONSTRAINT "form_logic_rules_value_matches_operator";--> statement-breakpoint
ALTER TABLE "form_logic_rules" DROP CONSTRAINT "form_logic_rules_target_matches_action";--> statement-breakpoint
ALTER TABLE "form_logic_rules" DROP CONSTRAINT "form_logic_rules_no_self_jump";--> statement-breakpoint
ALTER TABLE "form_logic_rules" ALTER COLUMN "operator" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "match" "logic_match" DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "else_action" "logic_action";--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "else_target_field_id" uuid;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "else_target_segment_id" uuid;--> statement-breakpoint
ALTER TABLE "form_logic_conditions" ADD CONSTRAINT "form_logic_conditions_rule_id_form_logic_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."form_logic_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_conditions" ADD CONSTRAINT "form_logic_conditions_field_id_form_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_logic_conditions_rule_idx" ON "form_logic_conditions" USING btree ("rule_id","index");--> statement-breakpoint
CREATE INDEX "form_logic_conditions_field_idx" ON "form_logic_conditions" USING btree ("field_id");--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_else_target_field_id_form_fields_id_fk" FOREIGN KEY ("else_target_field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_else_target_segment_id_form_segments_id_fk" FOREIGN KEY ("else_target_segment_id") REFERENCES "public"."form_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_else_target_matches_action" CHECK ((
          ("form_logic_rules"."else_action" = 'JUMP_TO_FIELD' AND "form_logic_rules"."else_target_field_id" IS NOT NULL AND "form_logic_rules"."else_target_segment_id" IS NULL)
          OR ("form_logic_rules"."else_action" = 'JUMP_TO_SEGMENT' AND "form_logic_rules"."else_target_segment_id" IS NOT NULL AND "form_logic_rules"."else_target_field_id" IS NULL)
          OR (
            ("form_logic_rules"."else_action" IS NULL OR "form_logic_rules"."else_action" NOT IN ('JUMP_TO_FIELD', 'JUMP_TO_SEGMENT'))
            AND "form_logic_rules"."else_target_field_id" IS NULL
            AND "form_logic_rules"."else_target_segment_id" IS NULL
          )
        ));--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_target_matches_action" CHECK ((
          ("form_logic_rules"."action" = 'JUMP_TO_FIELD' AND "form_logic_rules"."target_field_id" IS NOT NULL AND "form_logic_rules"."target_segment_id" IS NULL)
          OR ("form_logic_rules"."action" = 'JUMP_TO_SEGMENT' AND "form_logic_rules"."target_segment_id" IS NOT NULL AND "form_logic_rules"."target_field_id" IS NULL)
          OR ("form_logic_rules"."action" NOT IN ('JUMP_TO_FIELD', 'JUMP_TO_SEGMENT') AND "form_logic_rules"."target_field_id" IS NULL AND "form_logic_rules"."target_segment_id" IS NULL)
        ));--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_no_self_jump" CHECK (("form_logic_rules"."target_field_id" IS NULL OR "form_logic_rules"."target_field_id" <> "form_logic_rules"."field_id")
            AND ("form_logic_rules"."else_target_field_id" IS NULL OR "form_logic_rules"."else_target_field_id" <> "form_logic_rules"."field_id"));
--> statement-breakpoint
-- Back-fill, hand-written: every rule created under the single-condition
-- schema becomes a one-condition rule. The rule's own operator/value WERE the
-- condition, and it read the trigger question's answer, so all three move
-- across verbatim and existing branching keeps behaving identically.
--
-- Must run before migration 0015 drops the source columns.
INSERT INTO "form_logic_conditions" ("rule_id", "field_id", "operator", "value", "index")
SELECT "id", "field_id", "operator", "value", 1
FROM "form_logic_rules"
WHERE "operator" IS NOT NULL;
