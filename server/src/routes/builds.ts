import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { projectWorkspaces } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { createBuildConfigSchema, updateBuildConfigSchema, triggerBuildSchema } from "@paperclipai/shared";
import { buildService } from "../services/builds.js";
import { assertCompanyAccess } from "./authz.js";
import { badRequest } from "../errors.js";

export function buildRoutes(db: Db) {
  const router = Router();
  const builds = buildService(db);

  /** Resolve workspace and validate access, returning companyId + cwd check */
  async function resolveWorkspace(req: any, res: any): Promise<{ companyId: string; workspaceId: string } | null> {
    const workspaceId = req.params.workspaceId as string;
    const workspace = await db
      .select()
      .from(projectWorkspaces)
      .where(eq(projectWorkspaces.id, workspaceId))
      .then((rows) => rows[0] ?? null);

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return null;
    }
    assertCompanyAccess(req, workspace.companyId);

    if (!workspace.cwd) {
      res.status(422).json({ error: "Workspace has no local directory" });
      return null;
    }
    return { companyId: workspace.companyId, workspaceId: workspace.id };
  }

  // ── Config CRUD ──

  // GET /builds/configs/:workspaceId
  router.get("/builds/configs/:workspaceId", async (req, res) => {
    const ctx = await resolveWorkspace(req, res);
    if (!ctx) return;
    const configs = await builds.listConfigs(ctx.companyId, ctx.workspaceId);
    res.json(configs);
  });

  // POST /builds/configs/:workspaceId
  router.post("/builds/configs/:workspaceId", async (req, res) => {
    const ctx = await resolveWorkspace(req, res);
    if (!ctx) return;
    const parsed = createBuildConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid build config", parsed.error.flatten());
    }
    const config = await builds.createConfig(ctx.companyId, ctx.workspaceId, parsed.data);
    res.status(201).json(config);
  });

  // PATCH /builds/configs/:configId
  router.patch("/builds/configs/detail/:configId", async (req, res) => {
    const configId = req.params.configId as string;
    const config = await builds.getConfig(configId);
    assertCompanyAccess(req, config.companyId);
    const parsed = updateBuildConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid build config update", parsed.error.flatten());
    }
    const updated = await builds.updateConfig(configId, parsed.data);
    res.json(updated);
  });

  // DELETE /builds/configs/:configId
  router.delete("/builds/configs/detail/:configId", async (req, res) => {
    const configId = req.params.configId as string;
    const config = await builds.getConfig(configId);
    assertCompanyAccess(req, config.companyId);
    await builds.deleteConfig(configId);
    res.json({ success: true });
  });

  // ── Company-wide runs ──

  // GET /builds/companies/:companyId/runs — all runs across workspaces
  router.get("/builds/companies/:companyId/runs", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const runs = await builds.listAllRuns(companyId, { status, workspaceId, limit });
    res.json(runs);
  });

  // ── Build runs ──

  // POST /builds/:workspaceId/trigger
  router.post("/builds/:workspaceId/trigger", async (req, res) => {
    const ctx = await resolveWorkspace(req, res);
    if (!ctx) return;
    const parsed = triggerBuildSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid trigger request", parsed.error.flatten());
    }
    const run = await builds.triggerBuild(ctx.companyId, ctx.workspaceId, parsed.data);
    res.status(201).json(run);
  });

  // GET /builds/:workspaceId/runs
  router.get("/builds/:workspaceId/runs", async (req, res) => {
    const ctx = await resolveWorkspace(req, res);
    if (!ctx) return;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const runs = await builds.listRuns(ctx.companyId, ctx.workspaceId, limit);
    res.json(runs);
  });

  // GET /builds/runs/:buildRunId
  router.get("/builds/runs/:buildRunId", async (req, res) => {
    const run = await builds.getRun(req.params.buildRunId);
    assertCompanyAccess(req, run.companyId);
    res.json(run);
  });

  // GET /builds/runs/:buildRunId/log
  router.get("/builds/runs/:buildRunId/log", async (req, res) => {
    const run = await builds.getRun(req.params.buildRunId);
    assertCompanyAccess(req, run.companyId);
    const offset = Number(req.query.offset) || 0;
    const limitBytes = Math.min(Number(req.query.limitBytes) || 256000, 1048576);
    const result = await builds.getRunLog(req.params.buildRunId, { offset, limitBytes });
    res.json(result);
  });

  // POST /builds/runs/:buildRunId/cancel
  router.post("/builds/runs/:buildRunId/cancel", async (req, res) => {
    const run = await builds.getRun(req.params.buildRunId);
    assertCompanyAccess(req, run.companyId);
    const cancelled = await builds.cancelBuild(req.params.buildRunId);
    res.json(cancelled);
  });

  return router;
}
