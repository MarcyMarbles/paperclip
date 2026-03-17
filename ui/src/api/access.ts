import type { AgentAdapterType, JoinRequest } from "@paperclipai/shared";
import { api } from "./client";

type InviteSummary = {
  id: string;
  companyId: string | null;
  inviteType: "company_join" | "bootstrap_ceo";
  allowedJoinTypes: "human" | "agent" | "both";
  expiresAt: string;
  onboardingPath?: string;
  onboardingUrl?: string;
  onboardingTextPath?: string;
  onboardingTextUrl?: string;
  skillIndexPath?: string;
  skillIndexUrl?: string;
  inviteMessage?: string | null;
};

type AcceptInviteInput =
  | { requestType: "human" }
  | {
    requestType: "agent";
    agentName: string;
    adapterType?: AgentAdapterType;
    capabilities?: string | null;
    agentDefaultsPayload?: Record<string, unknown> | null;
  };

type AgentJoinRequestAccepted = JoinRequest & {
  claimSecret: string;
  claimApiKeyPath: string;
  onboarding?: Record<string, unknown>;
  diagnostics?: Array<{
    code: string;
    level: "info" | "warn";
    message: string;
    hint?: string;
  }>;
};

type InviteOnboardingManifest = {
  invite: InviteSummary;
  onboarding: {
    inviteMessage?: string | null;
    connectivity?: {
      guidance?: string;
      connectionCandidates?: string[];
      testResolutionEndpoint?: {
        method?: string;
        path?: string;
        url?: string;
      };
    };
    textInstructions?: {
      url?: string;
    };
  };
};

type BoardClaimStatus = {
  status: "available" | "claimed" | "expired";
  requiresSignIn: boolean;
  expiresAt: string | null;
  claimedByUserId: string | null;
};

type CompanyInviteCreated = {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  allowedJoinTypes: "human" | "agent" | "both";
  onboardingTextPath?: string;
  onboardingTextUrl?: string;
  inviteMessage?: string | null;
};

import type { CompanyMembership, CompanyRole, MembershipRole, AgentAccessLevel } from "@paperclipai/shared";

type UserProjectAccessRow = { id: string; companyId: string; userId: string; projectId: string; grantedByUserId: string | null; createdAt: string };
type UserAgentAccessRow = { id: string; companyId: string; userId: string; agentId: string; accessLevel: string; grantedByUserId: string | null; createdAt: string };
type EffectivePermissions = { role: MembershipRole | null; permissions: Record<string, unknown> | null };

export type RolePermissions = {
  issues: { create: boolean; assign: boolean; manage: boolean };
  projects: { access: "assigned" | "all"; manage: boolean };
  agents: { interact: "none" | "request_only" | "assign" | "full"; manage: boolean };
  users: { invite: boolean; managePermissions: boolean };
  company: { manage: boolean };
};

export const rolesApi = {
  listMembers: (companyId: string) =>
    api.get<CompanyMembership[]>(`/companies/${companyId}/members`),

  listRoles: (companyId: string) =>
    api.get<CompanyRole[]>(`/companies/${companyId}/roles`),

  seedRoles: (companyId: string) =>
    api.post<CompanyRole[]>(`/companies/${companyId}/roles/seed`, {}),

  createRole: (companyId: string, input: { name: string; displayName: string; description?: string | null; permissions: RolePermissions }) =>
    api.post<CompanyRole>(`/companies/${companyId}/roles`, input),

  updateRole: (companyId: string, roleId: string, input: { displayName?: string; description?: string | null; permissions?: RolePermissions }) =>
    api.patch<CompanyRole>(`/companies/${companyId}/roles/${roleId}`, input),

  deleteRole: (companyId: string, roleId: string) =>
    api.delete<CompanyRole>(`/companies/${companyId}/roles/${roleId}`),

  assignRole: (companyId: string, userId: string, membershipRole: MembershipRole) =>
    api.patch<CompanyMembership>(`/companies/${companyId}/members/${userId}/role`, { membershipRole }),

  getEffectivePermissions: (companyId: string, userId: string) =>
    api.get<EffectivePermissions>(`/companies/${companyId}/members/${userId}/effective-permissions`),

  listUserProjectAccess: (companyId: string, userId: string) =>
    api.get<UserProjectAccessRow[]>(`/companies/${companyId}/members/${userId}/project-access`),

  setUserProjectAccess: (companyId: string, userId: string, projectIds: string[]) =>
    api.put<UserProjectAccessRow[]>(`/companies/${companyId}/project-access`, { userId, projectIds }),

  listUserAgentAccess: (companyId: string, userId: string) =>
    api.get<UserAgentAccessRow[]>(`/companies/${companyId}/members/${userId}/agent-access`),

  setUserAgentAccess: (companyId: string, userId: string, grants: Array<{ agentId: string; accessLevel: AgentAccessLevel }>) =>
    api.put<UserAgentAccessRow[]>(`/companies/${companyId}/agent-access`, { userId, grants }),
};

type AdminUser = { id: string; name: string | null; email: string; createdAt: string };

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>("/admin/users"),
  getUserCompanyAccess: (userId: string) =>
    api.get<CompanyMembership[]>(`/admin/users/${userId}/company-access`),
  setUserCompanyAccess: (userId: string, companyIds: string[]) =>
    api.put<CompanyMembership[]>(`/admin/users/${userId}/company-access`, { companyIds }),
};

export const accessApi = {
  createCompanyInvite: (
    companyId: string,
    input: {
      allowedJoinTypes?: "human" | "agent" | "both";
      defaultsPayload?: Record<string, unknown> | null;
      agentMessage?: string | null;
      membershipRole?: MembershipRole;
    } = {},
  ) =>
    api.post<CompanyInviteCreated>(`/companies/${companyId}/invites`, input),

  createOpenClawInvitePrompt: (
    companyId: string,
    input: {
      agentMessage?: string | null;
    } = {},
  ) =>
    api.post<CompanyInviteCreated>(
      `/companies/${companyId}/openclaw/invite-prompt`,
      input,
    ),

  getInvite: (token: string) => api.get<InviteSummary>(`/invites/${token}`),
  getInviteOnboarding: (token: string) =>
    api.get<InviteOnboardingManifest>(`/invites/${token}/onboarding`),

  acceptInvite: (token: string, input: AcceptInviteInput) =>
    api.post<AgentJoinRequestAccepted | JoinRequest | { bootstrapAccepted: true; userId: string }>(
      `/invites/${token}/accept`,
      input,
    ),

  listJoinRequests: (companyId: string, status: "pending_approval" | "approved" | "rejected" = "pending_approval") =>
    api.get<JoinRequest[]>(`/companies/${companyId}/join-requests?status=${status}`),

  approveJoinRequest: (companyId: string, requestId: string) =>
    api.post<JoinRequest>(`/companies/${companyId}/join-requests/${requestId}/approve`, {}),

  rejectJoinRequest: (companyId: string, requestId: string) =>
    api.post<JoinRequest>(`/companies/${companyId}/join-requests/${requestId}/reject`, {}),

  claimJoinRequestApiKey: (requestId: string, claimSecret: string) =>
    api.post<{ keyId: string; token: string; agentId: string; createdAt: string }>(
      `/join-requests/${requestId}/claim-api-key`,
      { claimSecret },
    ),

  getBoardClaimStatus: (token: string, code: string) =>
    api.get<BoardClaimStatus>(`/board-claim/${token}?code=${encodeURIComponent(code)}`),

  claimBoard: (token: string, code: string) =>
    api.post<{ claimed: true; userId: string }>(`/board-claim/${token}/claim`, { code }),
};
