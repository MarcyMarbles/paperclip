CREATE TABLE IF NOT EXISTS "webhook_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"provider" text DEFAULT 'github' NOT NULL,
	"token" text NOT NULL,
	"secret" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_action_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_config_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"action" text NOT NULL,
	"action_params" jsonb DEFAULT '{}'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_config_id" uuid,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"delivery_id" text,
	"payload" jsonb,
	"headers" jsonb,
	"status" text DEFAULT 'received' NOT NULL,
	"error_message" text,
	"matched_issues" jsonb,
	"processing_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_issue_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_type" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_action_rules" ADD CONSTRAINT "webhook_action_rules_webhook_config_id_webhook_configs_id_fk" FOREIGN KEY ("webhook_config_id") REFERENCES "public"."webhook_configs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_event_log" ADD CONSTRAINT "webhook_event_log_webhook_config_id_webhook_configs_id_fk" FOREIGN KEY ("webhook_config_id") REFERENCES "public"."webhook_configs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_event_log" ADD CONSTRAINT "webhook_event_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_issue_links" ADD CONSTRAINT "webhook_issue_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_issue_links" ADD CONSTRAINT "webhook_issue_links_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_configs_company_idx" ON "webhook_configs" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_configs_token_uq" ON "webhook_configs" USING btree ("token");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_configs_company_name_uq" ON "webhook_configs" USING btree ("company_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_action_rules_config_idx" ON "webhook_action_rules" USING btree ("webhook_config_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_event_log_company_idx" ON "webhook_event_log" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_event_log_config_idx" ON "webhook_event_log" USING btree ("webhook_config_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_event_log_created_at_idx" ON "webhook_event_log" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_issue_links_issue_idx" ON "webhook_issue_links" USING btree ("issue_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_issue_links_company_provider_uq" ON "webhook_issue_links" USING btree ("company_id","provider","external_type","external_id");
