import { pgTable, uuid, text, timestamp, index, integer, bigint } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projectWorkspaces } from "./project_workspaces.js";
import { buildConfigs } from "./build_configs.js";

export const buildRuns = pgTable(
  "build_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => projectWorkspaces.id, { onDelete: "cascade" }),
    configId: uuid("config_id").references(() => buildConfigs.id, { onDelete: "set null" }),
    command: text("command").notNull(),
    triggeredBy: text("triggered_by").notNull().default("user"),
    triggeredById: text("triggered_by_id"),
    status: text("status").notNull().default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    exitCode: integer("exit_code"),
    signal: text("signal"),
    error: text("error"),
    logStore: text("log_store"),
    logRef: text("log_ref"),
    logBytes: bigint("log_bytes", { mode: "number" }),
    logSha256: text("log_sha256"),
    stdoutExcerpt: text("stdout_excerpt"),
    stderrExcerpt: text("stderr_excerpt"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyWorkspaceCreatedIdx: index("build_runs_company_workspace_created_idx").on(
      table.companyId,
      table.workspaceId,
      table.createdAt,
    ),
  }),
);
