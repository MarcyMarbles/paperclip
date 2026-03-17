CREATE TABLE IF NOT EXISTS "company_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"permissions" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_project_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"granted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_agent_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"access_level" text DEFAULT 'request_only' NOT NULL,
	"granted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_roles" ADD CONSTRAINT "company_roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_project_access" ADD CONSTRAINT "user_project_access_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_project_access" ADD CONSTRAINT "user_project_access_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_roles_company_name_unique_idx" ON "company_roles" USING btree ("company_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_roles_company_idx" ON "company_roles" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_project_access_unique_idx" ON "user_project_access" USING btree ("company_id","user_id","project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_project_access_user_idx" ON "user_project_access" USING btree ("company_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_project_access_project_idx" ON "user_project_access" USING btree ("company_id","project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_agent_access_unique_idx" ON "user_agent_access" USING btree ("company_id","user_id","agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_agent_access_user_idx" ON "user_agent_access" USING btree ("company_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_agent_access_agent_idx" ON "user_agent_access" USING btree ("company_id","agent_id");
