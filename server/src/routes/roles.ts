import { Router } from "express";
import type { Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  assignMemberRoleSchema,
  createCompanyRoleSchema,
  grantAgentAccessSchema,
  grantProjectAccessSchema,
  updateCompanyRoleSchema,
} from "@paperclipai/shared";
import { forbidden, notFound, conflict, badRequest } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { accessService, roleService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

export function roleRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const roles = roleService(db);

  async function assertCanManageRoles(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      if (!req.actor.userId) throw forbidden("User context required");
      const allowed = await roles.canManageUsers(companyId, req.actor.userId);
      if (!allowed) throw forbidden("Missing permission: manage users/roles");
    } else {
      throw forbidden("Only board users can manage roles");
    }
  }

  // ─── Role definitions ──────────────────────────────────────────────

  router.get("/companies/:companyId/roles", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const list = await roles.listRoles(companyId);
    res.json(list);
  });

  router.get("/companies/:companyId/roles/:roleId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const role = await roles.getRoleById(req.params.roleId as string);
    if (!role || role.companyId !== companyId) throw notFound("Role not found");
    res.json(role);
  });

  router.post(
    "/companies/:companyId/roles",
    validate(createCompanyRoleSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManageRoles(req, companyId);
      const existing = await roles.getRoleByName(companyId, req.body.name);
      if (existing) throw conflict("Role with this name already exists");
      const created = await roles.createRole(companyId, req.body);
      res.status(201).json(created);
    },
  );

  router.patch(
    "/companies/:companyId/roles/:roleId",
    validate(updateCompanyRoleSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManageRoles(req, companyId);
      const role = await roles.getRoleById(req.params.roleId as string);
      if (!role || role.companyId !== companyId) throw notFound("Role not found");
      const updated = await roles.updateRole(role.id, req.body);
      res.json(updated);
    },
  );

  router.delete("/companies/:companyId/roles/:roleId", async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertCanManageRoles(req, companyId);
    const role = await roles.getRoleById(req.params.roleId as string);
    if (!role || role.companyId !== companyId) throw notFound("Role not found");
    if (role.isSystem) throw badRequest("Cannot delete a system role");
    const deleted = await roles.deleteRole(role.id);
    if (!deleted) throw badRequest("Cannot delete a system role");
    res.json(deleted);
  });

  // ─── Role assignment ───────────────────────────────────────────────

  router.patch(
    "/companies/:companyId/members/:userId/role",
    validate(assignMemberRoleSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.params.userId as string;
      await assertCanManageRoles(req, companyId);

      // Verify the role exists in this company
      const role = await roles.getRoleByName(companyId, req.body.membershipRole);
      if (!role) throw notFound("Role not found in this company");

      const membership = await access.getMembership(companyId, "user", userId);
      if (!membership) throw notFound("User is not a member of this company");

      const updated = await roles.assignRole(companyId, userId, req.body.membershipRole);
      if (!updated) throw notFound("Membership not found");
      res.json(updated);
    },
  );

  // ─── Effective permissions ─────────────────────────────────────────

  router.get("/companies/:companyId/members/:userId/effective-permissions", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.params.userId as string;
    assertCompanyAccess(req, companyId);

    // Users can check their own permissions; managers can check others
    if (req.actor.type === "board" && req.actor.userId !== userId) {
      if (req.actor.source !== "local_implicit" && !req.actor.isInstanceAdmin) {
        if (!req.actor.userId) throw forbidden("User context required");
        const canManage = await roles.canManageUsers(companyId, req.actor.userId);
        if (!canManage) throw forbidden("Cannot view other users' permissions");
      }
    }

    const roleName = await roles.getUserRole(companyId, userId);
    const perms = await roles.getEffectivePermissions(companyId, userId);
    res.json({ role: roleName, permissions: perms });
  });

  // ─── Project access grants ────────────────────────────────────────

  router.get("/companies/:companyId/members/:userId/project-access", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.params.userId as string;
    assertCompanyAccess(req, companyId);
    const grants = await roles.listUserProjectAccess(companyId, userId);
    res.json(grants);
  });

  router.put(
    "/companies/:companyId/project-access",
    validate(grantProjectAccessSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManageRoles(req, companyId);
      const grants = await roles.setUserProjectAccess(
        companyId,
        req.body.userId,
        req.body.projectIds,
        req.actor.type === "board" ? (req.actor.userId ?? null) : null,
      );
      res.json(grants);
    },
  );

  // ─── Agent access grants ──────────────────────────────────────────

  router.get("/companies/:companyId/members/:userId/agent-access", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.params.userId as string;
    assertCompanyAccess(req, companyId);
    const grants = await roles.listUserAgentAccess(companyId, userId);
    res.json(grants);
  });

  router.put(
    "/companies/:companyId/agent-access",
    validate(grantAgentAccessSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManageRoles(req, companyId);
      const grants = await roles.setUserAgentAccess(
        companyId,
        req.body.userId,
        req.body.grants,
        req.actor.type === "board" ? (req.actor.userId ?? null) : null,
      );
      res.json(grants);
    },
  );

  // ─── Seed endpoint (for initial setup) ────────────────────────────

  router.post("/companies/:companyId/roles/seed", async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertCanManageRoles(req, companyId);
    await roles.seedDefaultRoles(companyId);
    const list = await roles.listRoles(companyId);
    res.json(list);
  });

  return router;
}
