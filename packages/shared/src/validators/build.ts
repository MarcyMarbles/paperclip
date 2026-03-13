import { z } from "zod";

export const createBuildConfigSchema = z.object({
  name: z.string().min(1).max(255),
  command: z.string().min(1).max(4096),
  workingDir: z.string().max(1024).nullable().optional(),
  envVars: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(3600000).optional(),
});
export type CreateBuildConfig = z.infer<typeof createBuildConfigSchema>;

export const updateBuildConfigSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  command: z.string().min(1).max(4096).optional(),
  workingDir: z.string().max(1024).nullable().optional(),
  envVars: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(3600000).optional(),
});
export type UpdateBuildConfig = z.infer<typeof updateBuildConfigSchema>;

export const triggerBuildSchema = z.object({
  configId: z.string().uuid().optional(),
  command: z.string().min(1).max(4096).optional(),
  triggeredBy: z.string().max(64).optional(),
  triggeredById: z.string().max(255).optional(),
});
export type TriggerBuild = z.infer<typeof triggerBuildSchema>;
