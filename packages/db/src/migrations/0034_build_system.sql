CREATE TABLE IF NOT EXISTS "build_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "workspace_id" uuid NOT NULL REFERENCES "project_workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "command" text NOT NULL,
  "working_dir" text,
  "env_vars" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "timeout_ms" integer NOT NULL DEFAULT 300000,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "build_configs_company_workspace_idx" ON "build_configs" ("company_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "build_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "workspace_id" uuid NOT NULL REFERENCES "project_workspaces"("id") ON DELETE CASCADE,
  "config_id" uuid REFERENCES "build_configs"("id") ON DELETE SET NULL,
  "command" text NOT NULL,
  "triggered_by" text NOT NULL DEFAULT 'user',
  "triggered_by_id" text,
  "status" text NOT NULL DEFAULT 'queued',
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "exit_code" integer,
  "signal" text,
  "error" text,
  "log_store" text,
  "log_ref" text,
  "log_bytes" bigint,
  "log_sha256" text,
  "stdout_excerpt" text,
  "stderr_excerpt" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "build_runs_company_workspace_created_idx" ON "build_runs" ("company_id", "workspace_id", "created_at" DESC);
