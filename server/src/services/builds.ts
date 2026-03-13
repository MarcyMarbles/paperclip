import { spawn, type ChildProcess } from "node:child_process";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { buildConfigs, buildRuns, projectWorkspaces, projects } from "@paperclipai/db";
import type { BuildRunStatus } from "@paperclipai/shared";
import { badRequest, notFound } from "../errors.js";
import { logger } from "../middleware/logger.js";
import { publishLiveEvent } from "./live-events.js";
import { getRunLogStore, type RunLogHandle } from "./run-log-store.js";

const MAX_EXCERPT_BYTES = 4096;
const MAX_LIVE_LOG_CHUNK_BYTES = 8 * 1024;
const runningProcesses = new Map<string, ChildProcess>();

function appendExcerpt(prev: string, chunk: string): string {
  const combined = prev + chunk;
  if (combined.length <= MAX_EXCERPT_BYTES) return combined;
  return combined.slice(combined.length - MAX_EXCERPT_BYTES);
}

export function buildService(db: Db) {
  const logStore = getRunLogStore();

  // ── Config CRUD ──

  async function listConfigs(companyId: string, workspaceId: string) {
    return db
      .select()
      .from(buildConfigs)
      .where(and(eq(buildConfigs.companyId, companyId), eq(buildConfigs.workspaceId, workspaceId)))
      .orderBy(buildConfigs.createdAt);
  }

  async function getConfig(configId: string) {
    const row = await db
      .select()
      .from(buildConfigs)
      .where(eq(buildConfigs.id, configId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Build config not found");
    return row;
  }

  async function createConfig(
    companyId: string,
    workspaceId: string,
    data: { name: string; command: string; workingDir?: string | null; envVars?: Record<string, string>; timeoutMs?: number },
  ) {
    const [row] = await db
      .insert(buildConfigs)
      .values({
        companyId,
        workspaceId,
        name: data.name,
        command: data.command,
        workingDir: data.workingDir ?? null,
        envVars: data.envVars ?? {},
        timeoutMs: data.timeoutMs ?? 300000,
      })
      .returning();
    return row!;
  }

  async function updateConfig(
    configId: string,
    data: { name?: string; command?: string; workingDir?: string | null; envVars?: Record<string, string>; timeoutMs?: number },
  ) {
    const [row] = await db
      .update(buildConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(buildConfigs.id, configId))
      .returning();
    if (!row) throw notFound("Build config not found");
    return row;
  }

  async function deleteConfig(configId: string) {
    const [row] = await db
      .delete(buildConfigs)
      .where(eq(buildConfigs.id, configId))
      .returning();
    if (!row) throw notFound("Build config not found");
    return row;
  }

  // ── Runs ──

  async function listRuns(companyId: string, workspaceId: string, limit = 50) {
    return db
      .select()
      .from(buildRuns)
      .where(and(eq(buildRuns.companyId, companyId), eq(buildRuns.workspaceId, workspaceId)))
      .orderBy(desc(buildRuns.createdAt))
      .limit(limit);
  }

  async function listAllRuns(
    companyId: string,
    opts?: { status?: string; workspaceId?: string; limit?: number },
  ) {
    const conditions = [eq(buildRuns.companyId, companyId)];
    if (opts?.status) {
      const statuses = opts.status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(eq(buildRuns.status, statuses[0]!));
      } else if (statuses.length > 1) {
        conditions.push(inArray(buildRuns.status, statuses));
      }
    }
    if (opts?.workspaceId) {
      conditions.push(eq(buildRuns.workspaceId, opts.workspaceId));
    }
    const limit = Math.min(opts?.limit ?? 100, 500);

    const rows = await db
      .select({
        id: buildRuns.id,
        companyId: buildRuns.companyId,
        workspaceId: buildRuns.workspaceId,
        configId: buildRuns.configId,
        command: buildRuns.command,
        triggeredBy: buildRuns.triggeredBy,
        triggeredById: buildRuns.triggeredById,
        status: buildRuns.status,
        startedAt: buildRuns.startedAt,
        finishedAt: buildRuns.finishedAt,
        exitCode: buildRuns.exitCode,
        signal: buildRuns.signal,
        error: buildRuns.error,
        logStore: buildRuns.logStore,
        logRef: buildRuns.logRef,
        logBytes: buildRuns.logBytes,
        logSha256: buildRuns.logSha256,
        stdoutExcerpt: buildRuns.stdoutExcerpt,
        stderrExcerpt: buildRuns.stderrExcerpt,
        createdAt: buildRuns.createdAt,
        updatedAt: buildRuns.updatedAt,
        workspaceName: projectWorkspaces.name,
        workspaceCwd: projectWorkspaces.cwd,
        projectId: projectWorkspaces.projectId,
        projectName: projects.name,
        projectColor: projects.color,
      })
      .from(buildRuns)
      .innerJoin(projectWorkspaces, eq(buildRuns.workspaceId, projectWorkspaces.id))
      .innerJoin(projects, eq(projectWorkspaces.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(buildRuns.createdAt))
      .limit(limit);

    return rows;
  }

  async function getRun(buildRunId: string) {
    const row = await db
      .select()
      .from(buildRuns)
      .where(eq(buildRuns.id, buildRunId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Build run not found");
    return row;
  }

  async function getRunLog(buildRunId: string, opts?: { offset?: number; limitBytes?: number }) {
    const run = await getRun(buildRunId);
    if (!run.logStore || !run.logRef) throw notFound("Build run log not found");
    return logStore.read({ store: run.logStore as "local_file", logRef: run.logRef }, opts);
  }

  // ── Execution ──

  async function triggerBuild(
    companyId: string,
    workspaceId: string,
    opts: { configId?: string; command?: string; triggeredBy?: string; triggeredById?: string },
  ) {
    let command = opts.command;
    let configId = opts.configId ?? null;
    let timeoutMs = 300000;
    let workingDir: string | null = null;
    let envVars: Record<string, string> = {};

    if (configId) {
      const config = await getConfig(configId);
      command = config.command;
      timeoutMs = config.timeoutMs;
      workingDir = config.workingDir;
      envVars = (config.envVars as Record<string, string>) ?? {};
    }

    if (!command) throw badRequest("Either configId or command is required");

    // Resolve workspace cwd
    const workspace = await db
      .select()
      .from(projectWorkspaces)
      .where(eq(projectWorkspaces.id, workspaceId))
      .then((rows) => rows[0] ?? null);
    if (!workspace?.cwd) throw badRequest("Workspace has no local directory");

    const cwd = workingDir ? `${workspace.cwd}/${workingDir}` : workspace.cwd;

    // Create run record
    const [run] = await db
      .insert(buildRuns)
      .values({
        companyId,
        workspaceId,
        configId,
        command,
        triggeredBy: opts.triggeredBy ?? "user",
        triggeredById: opts.triggeredById ?? null,
        status: "queued",
      })
      .returning();

    if (!run) throw new Error("Failed to create build run");

    publishLiveEvent({
      companyId,
      type: "build.run.queued",
      payload: { buildRunId: run.id, workspaceId, command, configId },
    });

    // Start execution asynchronously
    void executeBuild(run.id, companyId, workspaceId, command, cwd, envVars, timeoutMs);

    return run;
  }

  async function executeBuild(
    runId: string,
    companyId: string,
    workspaceId: string,
    command: string,
    cwd: string,
    envVars: Record<string, string>,
    timeoutMs: number,
  ) {
    let logHandle: RunLogHandle | null = null;
    let stdoutExcerpt = "";
    let stderrExcerpt = "";

    try {
      logHandle = await logStore.begin({ companyId, agentId: "build", runId });

      await db
        .update(buildRuns)
        .set({ status: "running", startedAt: new Date(), logStore: logHandle.store, logRef: logHandle.logRef, updatedAt: new Date() })
        .where(eq(buildRuns.id, runId));

      publishLiveEvent({
        companyId,
        type: "build.run.status",
        payload: { buildRunId: runId, workspaceId, status: "running" },
      });

      const child = spawn(command, [], {
        shell: true,
        cwd,
        env: { ...process.env, ...envVars },
        stdio: ["ignore", "pipe", "pipe"],
      });

      runningProcesses.set(runId, child);

      const timeoutHandle = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 5000);
      }, timeoutMs);

      const appendLog = async (stream: "stdout" | "stderr", chunk: string) => {
        if (!logHandle) return;
        await logStore.append(logHandle, { stream, chunk, ts: new Date().toISOString() });
        publishLiveEvent({
          companyId,
          type: "build.run.log",
          payload: {
            buildRunId: runId,
            workspaceId,
            stream,
            chunk: chunk.length > MAX_LIVE_LOG_CHUNK_BYTES ? chunk.slice(0, MAX_LIVE_LOG_CHUNK_BYTES) : chunk,
          },
        });
      };

      child.stdout?.on("data", (data: Buffer) => {
        const text = data.toString("utf8");
        stdoutExcerpt = appendExcerpt(stdoutExcerpt, text);
        void appendLog("stdout", text);
      });

      child.stderr?.on("data", (data: Buffer) => {
        const text = data.toString("utf8");
        stderrExcerpt = appendExcerpt(stderrExcerpt, text);
        void appendLog("stderr", text);
      });

      const { exitCode, signal } = await new Promise<{ exitCode: number | null; signal: string | null }>((resolve) => {
        child.on("close", (code, sig) => resolve({ exitCode: code, signal: sig }));
      });

      clearTimeout(timeoutHandle);
      runningProcesses.delete(runId);

      const status: BuildRunStatus = exitCode === 0 ? "succeeded" : "failed";
      const logSummary = logHandle ? await logStore.finalize(logHandle) : null;

      await db
        .update(buildRuns)
        .set({
          status,
          finishedAt: new Date(),
          exitCode,
          signal,
          logBytes: logSummary?.bytes ?? null,
          logSha256: logSummary?.sha256 ?? null,
          stdoutExcerpt: stdoutExcerpt || null,
          stderrExcerpt: stderrExcerpt || null,
          updatedAt: new Date(),
        })
        .where(eq(buildRuns.id, runId));

      publishLiveEvent({
        companyId,
        type: "build.run.status",
        payload: { buildRunId: runId, workspaceId, status, exitCode, signal },
      });
    } catch (err) {
      runningProcesses.delete(runId);
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ err, runId }, "Build execution failed");

      if (logHandle) {
        try {
          await logStore.append(logHandle, { stream: "system", chunk: `Error: ${errorMessage}`, ts: new Date().toISOString() });
          await logStore.finalize(logHandle);
        } catch {
          // ignore finalize errors
        }
      }

      await db
        .update(buildRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          error: errorMessage,
          stdoutExcerpt: stdoutExcerpt || null,
          stderrExcerpt: stderrExcerpt || null,
          updatedAt: new Date(),
        })
        .where(eq(buildRuns.id, runId));

      publishLiveEvent({
        companyId,
        type: "build.run.status",
        payload: { buildRunId: runId, workspaceId, status: "failed", error: errorMessage },
      });
    }
  }

  async function cancelBuild(buildRunId: string) {
    const run = await getRun(buildRunId);
    if (run.status !== "queued" && run.status !== "running") {
      throw badRequest("Build run is not active");
    }

    const child = runningProcesses.get(buildRunId);
    if (child) {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    }

    runningProcesses.delete(buildRunId);

    await db
      .update(buildRuns)
      .set({ status: "cancelled", finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(buildRuns.id, buildRunId));

    publishLiveEvent({
      companyId: run.companyId,
      type: "build.run.status",
      payload: { buildRunId, workspaceId: run.workspaceId, status: "cancelled" },
    });

    return { ...run, status: "cancelled" as const };
  }

  return {
    listConfigs,
    getConfig,
    createConfig,
    updateConfig,
    deleteConfig,
    listRuns,
    listAllRuns,
    getRun,
    getRunLog,
    triggerBuild,
    cancelBuild,
  };
}
