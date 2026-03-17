import { z } from "zod";
import {
  AGENT_ACCESS_LEVELS,
  AGENT_ADAPTER_TYPES,
  INVITE_JOIN_TYPES,
  JOIN_REQUEST_STATUSES,
  JOIN_REQUEST_TYPES,
  MEMBERSHIP_ROLES,
  PERMISSION_KEYS,
  PROJECT_ACCESS_MODES,
} from "../constants.js";

export const createCompanyInviteSchema = z.object({
  allowedJoinTypes: z.enum(INVITE_JOIN_TYPES).default("both"),
  defaultsPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  agentMessage: z.string().max(4000).optional().nullable(),
  membershipRole: z.enum(MEMBERSHIP_ROLES).optional(),
});

export type CreateCompanyInvite = z.infer<typeof createCompanyInviteSchema>;

export const createOpenClawInvitePromptSchema = z.object({
  agentMessage: z.string().max(4000).optional().nullable(),
});

export type CreateOpenClawInvitePrompt = z.infer<
  typeof createOpenClawInvitePromptSchema
>;

export const acceptInviteSchema = z.object({
  requestType: z.enum(JOIN_REQUEST_TYPES),
  agentName: z.string().min(1).max(120).optional(),
  adapterType: z.enum(AGENT_ADAPTER_TYPES).optional(),
  capabilities: z.string().max(4000).optional().nullable(),
  agentDefaultsPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  // OpenClaw join compatibility fields accepted at top level.
  responsesWebhookUrl: z.string().max(4000).optional().nullable(),
  responsesWebhookMethod: z.string().max(32).optional().nullable(),
  responsesWebhookHeaders: z.record(z.string(), z.unknown()).optional().nullable(),
  paperclipApiUrl: z.string().max(4000).optional().nullable(),
  webhookAuthHeader: z.string().max(4000).optional().nullable(),
});

export type AcceptInvite = z.infer<typeof acceptInviteSchema>;

export const listJoinRequestsQuerySchema = z.object({
  status: z.enum(JOIN_REQUEST_STATUSES).optional(),
  requestType: z.enum(JOIN_REQUEST_TYPES).optional(),
});

export type ListJoinRequestsQuery = z.infer<typeof listJoinRequestsQuerySchema>;

export const claimJoinRequestApiKeySchema = z.object({
  claimSecret: z.string().min(16).max(256),
});

export type ClaimJoinRequestApiKey = z.infer<typeof claimJoinRequestApiKeySchema>;

export const updateMemberPermissionsSchema = z.object({
  grants: z.array(
    z.object({
      permissionKey: z.enum(PERMISSION_KEYS),
      scope: z.record(z.string(), z.unknown()).optional().nullable(),
    }),
  ),
});

export type UpdateMemberPermissions = z.infer<typeof updateMemberPermissionsSchema>;

export const updateUserCompanyAccessSchema = z.object({
  companyIds: z.array(z.string().uuid()).default([]),
});

export type UpdateUserCompanyAccess = z.infer<typeof updateUserCompanyAccessSchema>;

export const approveJoinRequestSchema = z.object({
  membershipRole: z.enum(MEMBERSHIP_ROLES).optional(),
});

export type ApproveJoinRequest = z.infer<typeof approveJoinRequestSchema>;

export const rolePermissionsSchema = z.object({
  issues: z.object({
    create: z.boolean(),
    assign: z.boolean(),
    manage: z.boolean(),
  }),
  projects: z.object({
    access: z.enum(PROJECT_ACCESS_MODES),
    manage: z.boolean(),
  }),
  agents: z.object({
    interact: z.enum(AGENT_ACCESS_LEVELS),
    manage: z.boolean(),
  }),
  users: z.object({
    invite: z.boolean(),
    managePermissions: z.boolean(),
  }),
  company: z.object({
    manage: z.boolean(),
  }),
});

export const createCompanyRoleSchema = z.object({
  name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "Must be lowercase snake_case"),
  displayName: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  permissions: rolePermissionsSchema,
});

export type CreateCompanyRole = z.infer<typeof createCompanyRoleSchema>;

export const updateCompanyRoleSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  permissions: rolePermissionsSchema.optional(),
});

export type UpdateCompanyRole = z.infer<typeof updateCompanyRoleSchema>;

export const assignMemberRoleSchema = z.object({
  membershipRole: z.enum(MEMBERSHIP_ROLES),
});

export type AssignMemberRole = z.infer<typeof assignMemberRoleSchema>;

export const grantProjectAccessSchema = z.object({
  userId: z.string().min(1),
  projectIds: z.array(z.string().uuid()),
});

export type GrantProjectAccess = z.infer<typeof grantProjectAccessSchema>;

export const grantAgentAccessSchema = z.object({
  userId: z.string().min(1),
  grants: z.array(
    z.object({
      agentId: z.string().uuid(),
      accessLevel: z.enum(AGENT_ACCESS_LEVELS),
    }),
  ),
});

export type GrantAgentAccess = z.infer<typeof grantAgentAccessSchema>;
