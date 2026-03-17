import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Building2, Check, X } from "lucide-react";
import type { CompanyMembership } from "@paperclipai/shared";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { adminApi } from "../api/access";
import { companiesApi } from "../api/companies";
import { queryKeys } from "../lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

type AdminUser = { id: string; name: string | null; email: string; createdAt: string };

function CompanyAccessDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const companiesQuery = useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: () => companiesApi.list(),
    enabled: open,
  });

  const accessQuery = useQuery({
    queryKey: queryKeys.instance.userCompanyAccess(user?.id ?? ""),
    queryFn: () => adminApi.getUserCompanyAccess(user!.id),
    enabled: open && !!user,
  });

  useEffect(() => {
    if (accessQuery.data) {
      setSelected(new Set(accessQuery.data.map((m) => m.companyId)));
    }
  }, [accessQuery.data]);

  const mutation = useMutation({
    mutationFn: () => adminApi.setUserCompanyAccess(user!.id, Array.from(selected)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instance.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.instance.userCompanyAccess(user!.id) });
      onOpenChange(false);
    },
  });

  if (!user) return null;

  const companies = companiesQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Company Access</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm text-muted-foreground">
            Manage company access for <span className="font-medium text-foreground">{user.name ?? user.email}</span>
          </div>

          {companiesQuery.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading companies...</div>
          ) : companies.length === 0 ? (
            <div className="text-xs text-muted-foreground">No companies found</div>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {companies.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/30"
                >
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(c.id);
                      else next.delete(c.id);
                      setSelected(next);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.issuePrefix}</div>
                  </div>
                  {selected.has(c.id) && (
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
        {mutation.isError && (
          <p className="text-xs text-destructive">{(mutation.error as any)?.message ?? "Failed"}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InstanceUsers() {
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => { setBreadcrumbs([{ label: "Users" }]); }, [setBreadcrumbs]);

  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const usersQuery = useQuery({
    queryKey: queryKeys.instance.users,
    queryFn: () => adminApi.listUsers(),
  });

  const users = usersQuery.data ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Users</h1>
        <span className="text-sm text-muted-foreground">({users.length})</span>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Email</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">ID</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {usersQuery.isLoading ? "Loading..." : "No users found"}
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                <td className="px-3 py-2 text-sm">{u.name ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{u.id}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => { setSelectedUser(u); setAccessDialogOpen(true); }}
                  >
                    <Building2 className="h-3 w-3 mr-1" />
                    Companies
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CompanyAccessDialog
        open={accessDialogOpen}
        onOpenChange={setAccessDialogOpen}
        user={selectedUser}
      />
    </div>
  );
}
