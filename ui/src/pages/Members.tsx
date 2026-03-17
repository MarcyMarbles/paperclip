import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Shield, Plus, Pencil, Trash2, UserPlus, FolderOpen, Bot } from "lucide-react";
import type { CompanyMembership, CompanyRole, MembershipRole, AgentAccessLevel } from "@paperclipai/shared";
import { MEMBERSHIP_ROLES, AGENT_ACCESS_LEVELS, PROJECT_ACCESS_MODES } from "@paperclipai/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { rolesApi, type RolePermissions } from "../api/access";
import { accessApi } from "../api/access";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Helpers ──────────────────────────────────────────────────────────

const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  owner: "default", admin: "default", manager: "secondary",
  member: "outline", contributor: "outline", requester: "outline",
};

function RoleBadge({ role }: { role: string | null }) {
  return (
    <Badge variant={ROLE_BADGE_VARIANT[role ?? ""] ?? "outline"} className="text-[10px]">
      {role ?? "—"}
    </Badge>
  );
}

const DEFAULT_PERMISSIONS: RolePermissions = {
  issues: { create: true, assign: false, manage: false },
  projects: { access: "assigned", manage: false },
  agents: { interact: "none", manage: false },
  users: { invite: false, managePermissions: false },
  company: { manage: false },
};

// ─── Permissions Editor ───────────────────────────────────────────────

function PermissionsEditor({
  value,
  onChange,
}: {
  value: RolePermissions;
  onChange: (v: RolePermissions) => void;
}) {
  const set = (path: string, val: unknown) => {
    const next = JSON.parse(JSON.stringify(value)) as any;
    const parts = path.split(".");
    let cur = next;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = val;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Issues */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Issues</legend>
        <div className="flex flex-wrap gap-4">
          {(["create", "assign", "manage"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox
                checked={value.issues[k]}
                onCheckedChange={(c) => set(`issues.${k}`, !!c)}
              />
              {k}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Projects */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projects</legend>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Access:</span>
            <Select
              value={value.projects.access}
              onValueChange={(v) => set("projects.access", v)}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_ACCESS_MODES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={value.projects.manage}
              onCheckedChange={(c) => set("projects.manage", !!c)}
            />
            manage
          </label>
        </div>
      </fieldset>

      {/* Agents */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agents</legend>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Interact:</span>
            <Select
              value={value.agents.interact}
              onValueChange={(v) => set("agents.interact", v)}
            >
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_ACCESS_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={value.agents.manage}
              onCheckedChange={(c) => set("agents.manage", !!c)}
            />
            manage
          </label>
        </div>
      </fieldset>

      {/* Users */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Users</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={value.users.invite}
              onCheckedChange={(c) => set("users.invite", !!c)}
            />
            invite
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={value.users.managePermissions}
              onCheckedChange={(c) => set("users.managePermissions", !!c)}
            />
            manage permissions
          </label>
        </div>
      </fieldset>

      {/* Company */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</legend>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox
            checked={value.company.manage}
            onCheckedChange={(c) => set("company.manage", !!c)}
          />
          manage
        </label>
      </fieldset>
    </div>
  );
}

// ─── Create / Edit Role Dialog ────────────────────────────────────────

function RoleDialog({
  open,
  onOpenChange,
  companyId,
  editRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  editRole: CompanyRole | null;
}) {
  const isEdit = !!editRole;
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (editRole) {
      setName(editRole.name);
      setDisplayName(editRole.displayName);
      setDescription(editRole.description ?? "");
      setPermissions(editRole.permissions as RolePermissions);
    } else {
      setName("");
      setDisplayName("");
      setDescription("");
      setPermissions(DEFAULT_PERMISSIONS);
    }
  }, [editRole, open]);

  const createMutation = useMutation({
    mutationFn: () =>
      rolesApi.createRole(companyId, { name, displayName, description: description || null, permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.roles(companyId) });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      rolesApi.updateRole(companyId, editRole!.id, { displayName, description: description || null, permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.roles(companyId) });
      onOpenChange(false);
    },
  });

  const mutation = isEdit ? updateMutation : createMutation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Role" : "Create Role"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Name (slug)</label>
              <input
                className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                placeholder="e.g. reviewer"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Lowercase, a-z, 0-9, underscores only</p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Display Name</label>
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              placeholder="e.g. Reviewer"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Description</label>
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              placeholder="What this role can do..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-xs font-medium mb-3">Permissions</div>
            <PermissionsEditor value={permissions} onChange={setPermissions} />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={mutation.isPending || (!isEdit && (!name || !displayName))}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
        {mutation.isError && (
          <p className="text-xs text-destructive mt-1">
            {(mutation.error as any)?.message ?? "Failed to save role"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Role Dialog ───────────────────────────────────────────────

function AssignRoleDialog({
  open,
  onOpenChange,
  member,
  companyId,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: CompanyMembership | null;
  companyId: string;
  roles: CompanyRole[];
}) {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (member) setSelectedRole(member.membershipRole ?? "");
  }, [member]);

  const mutation = useMutation({
    mutationFn: () =>
      rolesApi.assignRole(companyId, member!.principalId, selectedRole as MembershipRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.members(companyId) });
      onOpenChange(false);
    },
  });

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Role</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            Assign role to <span className="font-medium text-foreground font-mono text-xs">{member.principalId}</span>
          </div>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role..." />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.name}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.displayName}</span>
                    <span className="text-xs text-muted-foreground">{r.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" disabled={!selectedRole || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invite Dialog ────────────────────────────────────────────────────

function InviteDialog({
  open,
  onOpenChange,
  companyId,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  roles: CompanyRole[];
}) {
  const [role, setRole] = useState("member");
  const [inviteResult, setInviteResult] = useState<{ token: string; inviteUrl?: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      accessApi.createCompanyInvite(companyId, {
        allowedJoinTypes: "human",
        membershipRole: role as MembershipRole,
      }),
    onSuccess: (data) => setInviteResult(data),
  });

  const handleClose = (v: boolean) => {
    if (!v) { setInviteResult(null); setRole("member"); }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>
        {inviteResult ? (
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">Share this invite link (expires in 10 min):</div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono break-all select-all">
              {inviteResult.inviteUrl ?? `Token: ${inviteResult.token}`}
            </div>
            <div className="text-xs text-muted-foreground">
              Will join as: <RoleBadge role={role} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">Create an invite link for a new user.</div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role on join</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.displayName}</span>
                        <span className="text-xs text-muted-foreground">{r.description ?? ""}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          {inviteResult ? (
            <Button size="sm" onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <>
              <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
              <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? "Creating..." : "Create Invite"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── User Access Dialog (Projects + Agents) ──────────────────────────

function UserAccessDialog({
  open,
  onOpenChange,
  member,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: CompanyMembership | null;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"projects" | "agents">("projects");
  const userId = member?.principalId ?? "";

  // ── Projects ──
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
    enabled: open,
  });
  const projectAccessQuery = useQuery({
    queryKey: queryKeys.access.memberProjectAccess(companyId, userId),
    queryFn: () => rolesApi.listUserProjectAccess(companyId, userId),
    enabled: open && !!userId,
  });
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (projectAccessQuery.data) {
      setSelectedProjects(new Set(projectAccessQuery.data.map((g) => g.projectId)));
    }
  }, [projectAccessQuery.data]);

  const saveProjectsMutation = useMutation({
    mutationFn: () => rolesApi.setUserProjectAccess(companyId, userId, Array.from(selectedProjects)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.memberProjectAccess(companyId, userId) });
    },
  });

  // ── Agents ──
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: open,
  });
  const agentAccessQuery = useQuery({
    queryKey: queryKeys.access.memberAgentAccess(companyId, userId),
    queryFn: () => rolesApi.listUserAgentAccess(companyId, userId),
    enabled: open && !!userId,
  });
  const [agentGrants, setAgentGrants] = useState<Map<string, AgentAccessLevel>>(new Map());
  useEffect(() => {
    if (agentAccessQuery.data) {
      setAgentGrants(new Map(agentAccessQuery.data.map((g) => [g.agentId, g.accessLevel as AgentAccessLevel])));
    }
  }, [agentAccessQuery.data]);

  const saveAgentsMutation = useMutation({
    mutationFn: () =>
      rolesApi.setUserAgentAccess(
        companyId,
        userId,
        Array.from(agentGrants.entries()).map(([agentId, accessLevel]) => ({ agentId, accessLevel })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.memberAgentAccess(companyId, userId) });
    },
  });

  if (!member) return null;

  const projects = projectsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>User Access</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-2">
          Configure project and agent access for <span className="font-mono font-medium text-foreground">{userId}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-3">
          <button
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === "projects" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("projects")}
          >
            <FolderOpen className="h-3 w-3 inline mr-1" />Projects
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${tab === "agents" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("agents")}
          >
            <Bot className="h-3 w-3 inline mr-1" />Agents
          </button>
        </div>

        <div className="max-h-[45vh] overflow-y-auto">
          {tab === "projects" ? (
            <div className="space-y-1.5">
              {projects.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No projects in this company</div>
              ) : projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/30">
                  <Checkbox
                    checked={selectedProjects.has(p.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedProjects);
                      if (checked) next.add(p.id); else next.delete(p.id);
                      setSelectedProjects(next);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    {p.description && <div className="text-[10px] text-muted-foreground truncate">{p.description}</div>}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {agents.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No agents in this company</div>
              ) : agents.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">{a.role}</div>
                  </div>
                  <Select
                    value={agentGrants.get(a.id) ?? "none"}
                    onValueChange={(v) => {
                      const next = new Map(agentGrants);
                      if (v === "none") next.delete(a.id);
                      else next.set(a.id, v as AgentAccessLevel);
                      setAgentGrants(next);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">none</SelectItem>
                      {AGENT_ACCESS_LEVELS.filter((l) => l !== "none").map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </DialogClose>
          {tab === "projects" ? (
            <Button size="sm" disabled={saveProjectsMutation.isPending} onClick={() => saveProjectsMutation.mutate()}>
              {saveProjectsMutation.isPending ? "Saving..." : "Save Projects"}
            </Button>
          ) : (
            <Button size="sm" disabled={saveAgentsMutation.isPending} onClick={() => saveAgentsMutation.mutate()}>
              {saveAgentsMutation.isPending ? "Saving..." : "Save Agents"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export function Members() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  useEffect(() => { setBreadcrumbs([{ label: "Members" }]); }, [setBreadcrumbs]);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CompanyRole | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CompanyMembership | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessMember, setAccessMember] = useState<CompanyMembership | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: queryKeys.access.members(selectedCompanyId!),
    queryFn: () => rolesApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const rolesQuery = useQuery({
    queryKey: queryKeys.access.roles(selectedCompanyId!),
    queryFn: () => rolesApi.listRoles(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const seedMutation = useMutation({
    mutationFn: () => rolesApi.seedRoles(selectedCompanyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.access.roles(selectedCompanyId!) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => rolesApi.deleteRole(selectedCompanyId!, roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.access.roles(selectedCompanyId!) }),
  });

  if (!selectedCompany) {
    return <div className="text-sm text-muted-foreground">No company selected</div>;
  }

  const members = membersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const userMembers = members.filter((m) => m.principalType === "user");
  const agentMembers = members.filter((m) => m.principalType === "agent");

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Members & Roles</h1>
        </div>
        <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Invite User
        </Button>
      </div>

      {/* ─── Users ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Users ({userMembers.length})
        </div>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">User</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {userMembers.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">No user members yet</td></tr>
              ) : userMembers.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs font-mono">{m.principalId}</td>
                  <td className="px-3 py-2"><RoleBadge role={m.membershipRole} /></td>
                  <td className="px-3 py-2">
                    <Badge variant={m.status === "active" ? "secondary" : "outline"} className="text-[10px]">{m.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setSelectedMember(m); setAssignDialogOpen(true); }}>
                        <Shield className="h-3 w-3 mr-1" />Role
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setAccessMember(m); setAccessDialogOpen(true); }}>
                        <FolderOpen className="h-3 w-3 mr-1" />Access
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Agents ────────────────────────────────────────────── */}
      {agentMembers.length > 0 && (
        <section className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Agents ({agentMembers.length})
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {agentMembers.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs font-mono">{m.principalId}</td>
                    <td className="px-3 py-2"><RoleBadge role={m.membershipRole} /></td>
                    <td className="px-3 py-2">
                      <Badge variant={m.status === "active" ? "secondary" : "outline"} className="text-[10px]">{m.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── Role Definitions (RT-configurable) ────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Role Definitions
          </div>
          <div className="flex gap-2">
            {roles.length === 0 && (
              <Button variant="outline" size="sm" className="text-xs h-7" disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
                {seedMutation.isPending ? "Seeding..." : "Seed Defaults"}
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setEditingRole(null); setRoleDialogOpen(true); }}>
              <Plus className="h-3 w-3 mr-1" />New Role
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Issues</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Projects</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Agents</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Users</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No roles defined. Seed defaults or create a custom role.
                  </td>
                </tr>
              ) : roles.map((r) => {
                const p = r.permissions as RolePermissions;
                return (
                  <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <RoleBadge role={r.name} />
                        {r.isSystem && <span className="text-[9px] text-muted-foreground italic">system</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[160px] truncate">
                      {r.description ?? r.displayName}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-0.5 flex-wrap">
                        {p.issues.create && <Badge variant="outline" className="text-[9px]">C</Badge>}
                        {p.issues.assign && <Badge variant="outline" className="text-[9px]">A</Badge>}
                        {p.issues.manage && <Badge variant="secondary" className="text-[9px]">M</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[9px]">{p.projects.access}</Badge>
                      {p.projects.manage && <Badge variant="secondary" className="text-[9px] ml-0.5">M</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[9px]">{p.agents.interact}</Badge>
                      {p.agents.manage && <Badge variant="secondary" className="text-[9px] ml-0.5">M</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-0.5 flex-wrap">
                        {p.users.invite && <Badge variant="outline" className="text-[9px]">inv</Badge>}
                        {p.users.managePermissions && <Badge variant="secondary" className="text-[9px]">mgr</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost" size="sm" className="h-6 w-6 p-0"
                          onClick={() => { setEditingRole(r); setRoleDialogOpen(true); }}
                          title="Edit role"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {!r.isSystem && (
                          <Button
                            variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => { if (confirm(`Delete role "${r.name}"?`)) deleteMutation.mutate(r.id); }}
                            title="Delete role"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Dialogs ───────────────────────────────────────────── */}
      <RoleDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        companyId={selectedCompanyId!}
        editRole={editingRole}
      />
      <AssignRoleDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        member={selectedMember}
        companyId={selectedCompanyId!}
        roles={roles}
      />
      <InviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        companyId={selectedCompanyId!}
        roles={roles}
      />
      <UserAccessDialog
        open={accessDialogOpen}
        onOpenChange={setAccessDialogOpen}
        member={accessMember}
        companyId={selectedCompanyId!}
      />
    </div>
  );
}
