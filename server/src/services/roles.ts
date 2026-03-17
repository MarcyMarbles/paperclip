import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companyMemberships,
  companyRoles,
  userProjectAccess,
  userAgentAccess,
} from "@paperclipai/db";
import type { AgentAccessLevel, MembershipRole, RolePermissions } from "@paperclipai/shared";

/**
 * Default system role definitions seeded per company.
 *
 * Hierarchy (most restricted → most privileged):
 *   requester → contributor → manager → admin → owner
 */
const SYSTEM_ROLE_DEFINITIONS: Array<{
  name: MembershipRole;
  displayName: string;
  description: string;
  permissions: RolePermissions;
}> = [
  {
    name: "requester",
    displayName: "Requester",
    description: "Can create unassigned issues that the CEO picks up during heartbeat",
    permissions: {
      issues: { create: true, assign: false, manage: false },
      projects: { access: "assigned", manage: false },
      agents: { interact: "none", manage: false },
      users: { invite: false, managePermissions: false },
      company: { manage: false },
    },
  },
  {
    name: "member",
    displayName: "Member",
    description: "Default role for new users — can create issues and assign to permitted agents",
    permissions: {
      issues: { create: true, assign: true, manage: false },
      projects: { access: "assigned", manage: false },
      agents: { interact: "assign", manage: false },
      users: { invite: false, managePermissions: false },
      company: { manage: false },
    },
  },
  {
    name: "contributor",
    displayName: "Contributor",
    description: "Can create issues and assign them to permitted agents",
    permissions: {
      issues: { create: true, assign: true, manage: false },
      projects: { access: "assigned", manage: false },
      agents: { interact: "assign", manage: false },
      users: { invite: false, managePermissions: false },
      company: { manage: false },
    },
  },
  {
    name: "manager",
    displayName: "Manager",
    description: "Full project and agent access, can manage issues and grant access",
    permissions: {
      issues: { create: true, assign: true, manage: true },
      projects: { access: "all", manage: true },
      agents: { interact: "full", manage: false },
      users: { invite: true, managePermissions: false },
      company: { manage: false },
    },
  },
  {
    name: "admin",
    displayName: "Admin",
    description: "Full access including user, agent, and company management",
    permissions: {
      issues: { create: true, assign: true, manage: true },
      projects: { access: "all", manage: true },
      agents: { interact: "full", manage: true },
      users: { invite: true, managePermissions: true },
      company: { manage: true },
    },
  },
  {
    name: "owner",
    displayName: "Owner",
    description: "Unrestricted access to everything",
    permissions: {
      issues: { create: true, assign: true, manage: true },
      projects: { access: "all", manage: true },
      agents: { interact: "full", manage: true },
      users: { invite: true, managePermissions: true },
      company: { manage: true },
    },
  },
];

export function roleService(db: Db) {
  // ─── Role CRUD ──────────────────────────────────────────────────────

  async function seedDefaultRoles(companyId: string) {
    const existing = await db
      .select({ name: companyRoles.name })
      .from(companyRoles)
      .where(eq(companyRoles.companyId, companyId));
    const existingNames = new Set(existing.map((r) => r.name));

    const toInsert = SYSTEM_ROLE_DEFINITIONS.filter((r) => !existingNames.has(r.name));
    if (toInsert.length === 0) return;

    await db.insert(companyRoles).values(
      toInsert.map((r) => ({
        companyId,
        name: r.name,
        displayName: r.displayName,
        description: r.description,
        permissions: r.permissions,
        isSystem: true,
      })),
    );
  }

  async function listRoles(companyId: string) {
    return db
      .select()
      .from(companyRoles)
      .where(eq(companyRoles.companyId, companyId))
      .orderBy(sql`${companyRoles.createdAt} asc`);
  }

  async function getRoleByName(companyId: string, name: string) {
    return db
      .select()
      .from(companyRoles)
      .where(and(eq(companyRoles.companyId, companyId), eq(companyRoles.name, name)))
      .then((rows) => rows[0] ?? null);
  }

  async function getRoleById(id: string) {
    return db
      .select()
      .from(companyRoles)
      .where(eq(companyRoles.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function createRole(
    companyId: string,
    input: { name: string; displayName: string; description?: string | null; permissions: RolePermissions },
  ) {
    return db
      .insert(companyRoles)
      .values({
        companyId,
        name: input.name,
        displayName: input.displayName,
        description: input.description ?? null,
        permissions: input.permissions,
        isSystem: false,
      })
      .returning()
      .then((rows) => rows[0]!);
  }

  async function updateRole(
    id: string,
    input: { displayName?: string; description?: string | null; permissions?: RolePermissions },
  ) {
    const sets: Record<string, unknown> = { updatedAt: new Date() };
    if (input.displayName !== undefined) sets.displayName = input.displayName;
    if (input.description !== undefined) sets.description = input.description;
    if (input.permissions !== undefined) sets.permissions = input.permissions;

    return db
      .update(companyRoles)
      .set(sets)
      .where(eq(companyRoles.id, id))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function deleteRole(id: string) {
    return db
      .delete(companyRoles)
      .where(and(eq(companyRoles.id, id), eq(companyRoles.isSystem, false)))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  // ─── Role assignment ───────────────────────────────────────────────

  async function assignRole(companyId: string, userId: string, membershipRole: MembershipRole) {
    return db
      .update(companyMemberships)
      .set({ membershipRole, updatedAt: new Date() })
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
        ),
      )
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  // ─── Effective permissions ─────────────────────────────────────────

  async function getUserRole(companyId: string, userId: string): Promise<MembershipRole | null> {
    const membership = await db
      .select({ membershipRole: companyMemberships.membershipRole })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
          eq(companyMemberships.status, "active"),
        ),
      )
      .then((rows) => rows[0] ?? null);
    return (membership?.membershipRole as MembershipRole) ?? null;
  }

  async function getEffectivePermissions(
    companyId: string,
    userId: string,
  ): Promise<RolePermissions | null> {
    const roleName = await getUserRole(companyId, userId);
    if (!roleName) return null;

    const role = await getRoleByName(companyId, roleName);
    if (!role) return null;

    return role.permissions as RolePermissions;
  }

  // ─── Project access ────────────────────────────────────────────────

  async function listUserProjectAccess(companyId: string, userId: string) {
    return db
      .select()
      .from(userProjectAccess)
      .where(
        and(
          eq(userProjectAccess.companyId, companyId),
          eq(userProjectAccess.userId, userId),
        ),
      );
  }

  async function setUserProjectAccess(
    companyId: string,
    userId: string,
    projectIds: string[],
    grantedByUserId: string | null,
  ) {
    await db.transaction(async (tx) => {
      await tx
        .delete(userProjectAccess)
        .where(
          and(
            eq(userProjectAccess.companyId, companyId),
            eq(userProjectAccess.userId, userId),
          ),
        );
      if (projectIds.length > 0) {
        await tx.insert(userProjectAccess).values(
          projectIds.map((projectId) => ({
            companyId,
            userId,
            projectId,
            grantedByUserId,
          })),
        );
      }
    });
    return listUserProjectAccess(companyId, userId);
  }

  async function canAccessProject(
    companyId: string,
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const perms = await getEffectivePermissions(companyId, userId);
    if (!perms) return false;
    if (perms.projects.access === "all") return true;

    const grant = await db
      .select({ id: userProjectAccess.id })
      .from(userProjectAccess)
      .where(
        and(
          eq(userProjectAccess.companyId, companyId),
          eq(userProjectAccess.userId, userId),
          eq(userProjectAccess.projectId, projectId),
        ),
      )
      .then((rows) => rows[0] ?? null);
    return Boolean(grant);
  }

  // ─── Agent access ─────────────────────────────────────────────────

  async function listUserAgentAccess(companyId: string, userId: string) {
    return db
      .select()
      .from(userAgentAccess)
      .where(
        and(
          eq(userAgentAccess.companyId, companyId),
          eq(userAgentAccess.userId, userId),
        ),
      );
  }

  async function setUserAgentAccess(
    companyId: string,
    userId: string,
    grants: Array<{ agentId: string; accessLevel: AgentAccessLevel }>,
    grantedByUserId: string | null,
  ) {
    await db.transaction(async (tx) => {
      await tx
        .delete(userAgentAccess)
        .where(
          and(
            eq(userAgentAccess.companyId, companyId),
            eq(userAgentAccess.userId, userId),
          ),
        );
      if (grants.length > 0) {
        await tx.insert(userAgentAccess).values(
          grants.map((g) => ({
            companyId,
            userId,
            agentId: g.agentId,
            accessLevel: g.accessLevel,
            grantedByUserId,
          })),
        );
      }
    });
    return listUserAgentAccess(companyId, userId);
  }

  async function getAgentAccessLevel(
    companyId: string,
    userId: string,
    agentId: string,
  ): Promise<AgentAccessLevel> {
    const perms = await getEffectivePermissions(companyId, userId);
    if (!perms) return "none";

    // Role-level baseline
    const roleLevel = perms.agents.interact;
    if (roleLevel === "full") return "full";

    // Check per-agent grant
    const grant = await db
      .select({ accessLevel: userAgentAccess.accessLevel })
      .from(userAgentAccess)
      .where(
        and(
          eq(userAgentAccess.companyId, companyId),
          eq(userAgentAccess.userId, userId),
          eq(userAgentAccess.agentId, agentId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!grant) return roleLevel;

    // Return the higher of role-level and per-agent grant
    const levels: AgentAccessLevel[] = ["none", "request_only", "assign", "full"];
    const roleIdx = levels.indexOf(roleLevel);
    const grantIdx = levels.indexOf(grant.accessLevel as AgentAccessLevel);
    return levels[Math.max(roleIdx, grantIdx)]!;
  }

  /**
   * Check whether a user can assign issues to a specific agent.
   * Returns true if effective agent access level is "assign" or "full".
   */
  async function canAssignToAgent(
    companyId: string,
    userId: string,
    agentId: string,
  ): Promise<boolean> {
    const level = await getAgentAccessLevel(companyId, userId, agentId);
    return level === "assign" || level === "full";
  }

  // ─── Composite checks ─────────────────────────────────────────────

  async function canCreateIssues(companyId: string, userId: string): Promise<boolean> {
    const perms = await getEffectivePermissions(companyId, userId);
    return perms?.issues.create ?? false;
  }

  async function canAssignIssues(companyId: string, userId: string): Promise<boolean> {
    const perms = await getEffectivePermissions(companyId, userId);
    return perms?.issues.assign ?? false;
  }

  async function canManageIssues(companyId: string, userId: string): Promise<boolean> {
    const perms = await getEffectivePermissions(companyId, userId);
    return perms?.issues.manage ?? false;
  }

  async function canManageAgents(companyId: string, userId: string): Promise<boolean> {
    const perms = await getEffectivePermissions(companyId, userId);
    return perms?.agents.manage ?? false;
  }

  async function canManageUsers(companyId: string, userId: string): Promise<boolean> {
    const perms = await getEffectivePermissions(companyId, userId);
    return perms?.users.managePermissions ?? false;
  }

  async function canManageCompany(companyId: string, userId: string): Promise<boolean> {
    const perms = await getEffectivePermissions(companyId, userId);
    return perms?.company.manage ?? false;
  }

  return {
    seedDefaultRoles,
    listRoles,
    getRoleByName,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    getUserRole,
    getEffectivePermissions,
    listUserProjectAccess,
    setUserProjectAccess,
    canAccessProject,
    listUserAgentAccess,
    setUserAgentAccess,
    getAgentAccessLevel,
    canAssignToAgent,
    canCreateIssues,
    canAssignIssues,
    canManageIssues,
    canManageAgents,
    canManageUsers,
    canManageCompany,
  };
}
