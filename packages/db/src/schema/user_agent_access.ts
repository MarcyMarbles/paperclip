import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const userAgentAccess = pgTable(
  "user_agent_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    accessLevel: text("access_level").notNull().default("request_only"),
    grantedByUserId: text("granted_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueAccessIdx: uniqueIndex("user_agent_access_unique_idx").on(
      table.companyId,
      table.userId,
      table.agentId,
    ),
    userIdx: index("user_agent_access_user_idx").on(table.companyId, table.userId),
    agentIdx: index("user_agent_access_agent_idx").on(table.companyId, table.agentId),
  }),
);
