ALTER TABLE "mcp_servers" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_servers_project_idx" ON "mcp_servers" USING btree ("project_id");--> statement-breakpoint
DROP INDEX "mcp_servers_company_name_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_servers_company_name_uq" ON "mcp_servers" USING btree ("company_id","name") WHERE "project_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_servers_company_project_name_uq" ON "mcp_servers" USING btree ("company_id","project_id","name") WHERE "project_id" IS NOT NULL;