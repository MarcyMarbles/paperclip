import { pgTable, uuid, text, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const companyRoles = pgTable(
  "company_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    permissions: jsonb("permissions").notNull().$type<{
      issues: { create: boolean; assign: boolean; manage: boolean };
      projects: { access: "assigned" | "all"; manage: boolean };
      agents: { interact: "none" | "request_only" | "assign" | "full"; manage: boolean };
      users: { invite: boolean; managePermissions: boolean };
      company: { manage: boolean };
    }>(),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUniqueIdx: uniqueIndex("company_roles_company_name_unique_idx").on(
      table.companyId,
      table.name,
    ),
    companyIdx: index("company_roles_company_idx").on(table.companyId),
  }),
);
