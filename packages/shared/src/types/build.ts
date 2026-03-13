import type { BuildRunStatus } from "../constants.js";

export interface BuildConfig {
  id: string;
  companyId: string;
  workspaceId: string;
  name: string;
  command: string;
  workingDir: string | null;
  envVars: Record<string, string>;
  timeoutMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildRun {
  id: string;
  companyId: string;
  workspaceId: string;
  configId: string | null;
  command: string;
  triggeredBy: string;
  triggeredById: string | null;
  status: BuildRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  exitCode: number | null;
  signal: string | null;
  error: string | null;
  logStore: string | null;
  logRef: string | null;
  logBytes: number | null;
  logSha256: string | null;
  stdoutExcerpt: string | null;
  stderrExcerpt: string | null;
  createdAt: Date;
  updatedAt: Date;
}
