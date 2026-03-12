ALTER TABLE "webhook_configs" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_configs_project_idx" ON "webhook_configs" USING btree ("project_id");
