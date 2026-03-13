import type { BuildConfig, BuildRun, CreateBuildConfig, UpdateBuildConfig, TriggerBuild } from "@paperclipai/shared";
import { api } from "./client";

function buildsPath(workspaceId: string, suffix: string) {
  return `/builds/${encodeURIComponent(workspaceId)}${suffix}`;
}

function configsPath(workspaceId: string) {
  return `/builds/configs/${encodeURIComponent(workspaceId)}`;
}

export interface BuildRunWithContext extends BuildRun {
  workspaceName: string;
  workspaceCwd: string | null;
  projectId: string;
  projectName: string;
  projectColor: string | null;
}

export const buildsApi = {
  // Company-wide
  listAllRuns: (companyId: string, opts?: { status?: string; workspaceId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.workspaceId) params.set("workspaceId", opts.workspaceId);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return api.get<BuildRunWithContext[]>(
      `/builds/companies/${encodeURIComponent(companyId)}/runs${qs ? `?${qs}` : ""}`,
    );
  },

  // Config CRUD
  listConfigs: (workspaceId: string) =>
    api.get<BuildConfig[]>(configsPath(workspaceId)),

  createConfig: (workspaceId: string, data: CreateBuildConfig) =>
    api.post<BuildConfig>(configsPath(workspaceId), data),

  updateConfig: (configId: string, data: UpdateBuildConfig) =>
    api.patch<BuildConfig>(`/builds/configs/detail/${encodeURIComponent(configId)}`, data),

  deleteConfig: (configId: string) =>
    api.delete<{ success: boolean }>(`/builds/configs/detail/${encodeURIComponent(configId)}`),

  // Build runs
  triggerBuild: (workspaceId: string, data: TriggerBuild) =>
    api.post<BuildRun>(buildsPath(workspaceId, "/trigger"), data),

  listRuns: (workspaceId: string, limit = 50) =>
    api.get<BuildRun[]>(buildsPath(workspaceId, `/runs?limit=${limit}`)),

  getRun: (buildRunId: string) =>
    api.get<BuildRun>(`/builds/runs/${encodeURIComponent(buildRunId)}`),

  getRunLog: (buildRunId: string, offset = 0, limitBytes = 256000) =>
    api.get<{ content: string; nextOffset?: number }>(
      `/builds/runs/${encodeURIComponent(buildRunId)}/log?offset=${offset}&limitBytes=${limitBytes}`,
    ),

  cancelRun: (buildRunId: string) =>
    api.post<BuildRun>(`/builds/runs/${encodeURIComponent(buildRunId)}/cancel`, {}),
};
