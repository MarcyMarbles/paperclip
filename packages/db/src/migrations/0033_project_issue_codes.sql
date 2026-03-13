ALTER TABLE "projects" ADD COLUMN "issue_prefix" text;
ALTER TABLE "projects" ADD COLUMN "issue_counter" integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "projects_issue_prefix_idx" ON "projects" ("issue_prefix") WHERE "issue_prefix" IS NOT NULL;
