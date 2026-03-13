import { pgTable, uuid, text, timestamp, jsonb, index, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projectWorkspaces } from "./project_workspaces.js";

export const buildConfigs = pgTable(
  "build_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => projectWorkspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    command: text("command").notNull(),
    workingDir: text("working_dir"),
    envVars: jsonb("env_vars").$type<Record<string, string>>().notNull().default({}),
    timeoutMs: integer("timeout_ms").notNull().default(300000),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyWorkspaceIdx: index("build_configs_company_workspace_idx").on(table.companyId, table.workspaceId),
  }),
);
