import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const userProjectAccess = pgTable(
  "user_project_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    grantedByUserId: text("granted_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueAccessIdx: uniqueIndex("user_project_access_unique_idx").on(
      table.companyId,
      table.userId,
      table.projectId,
    ),
    userIdx: index("user_project_access_user_idx").on(table.companyId, table.userId),
    projectIdx: index("user_project_access_project_idx").on(table.companyId, table.projectId),
  }),
);
