import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BuildConfig, BuildRun } from "@paperclipai/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { projectsApi } from "../api/projects";
import { buildsApi } from "../api/builds";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Square,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  FolderGit2,
  Pencil,
} from "lucide-react";
import { cn } from "../lib/utils";

/* ── Helpers ── */

function statusIcon(status: string) {
  switch (status) {
    case "queued":
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case "succeeded":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case "cancelled":
      return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return null;
  }
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running": return "default";
    case "succeeded": return "outline";
    case "failed": return "destructive";
    default: return "secondary";
  }
}

function formatDuration(start: Date | string | null, end: Date | string | null): string {
  if (!start) return "-";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTime(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return "just now";
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Log Viewer ── */

function BuildLogViewer({ buildRunId, status }: { buildRunId: string; status: string }) {
  const [logContent, setLogContent] = useState("");
  const nextOffsetRef = useRef(0);
  const scrollRef = useRef<HTMLPreElement>(null);
  const isActive = status === "running" || status === "queued";

  const fetchLog = useCallback(async () => {
    try {
      const result = await buildsApi.getRunLog(buildRunId, nextOffsetRef.current);
      if (result.content) {
        setLogContent((prev) => prev + result.content);
      }
      if (result.nextOffset !== undefined) {
        nextOffsetRef.current = result.nextOffset;
      }
    } catch {
      // ignore
    }
  }, [buildRunId]);

  useEffect(() => {
    nextOffsetRef.current = 0;
    setLogContent("");
    fetchLog();
  }, [buildRunId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(fetchLog, 1000);
    return () => clearInterval(interval);
  }, [isActive, fetchLog]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logContent]);

  const lines = logContent
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as { chunk?: string };
        return parsed.chunk ?? line;
      } catch {
        return line;
      }
    });

  return (
    <pre
      ref={scrollRef}
      className="bg-zinc-950 text-zinc-200 text-xs font-mono p-3 rounded-md overflow-auto max-h-[500px] whitespace-pre-wrap break-all"
    >
      {lines.length === 0 && isActive && (
        <span className="text-zinc-500">Waiting for output...</span>
      )}
      {lines.length === 0 && !isActive && (
        <span className="text-zinc-500">No output</span>
      )}
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </pre>
  );
}

/* ── Config Preset Card ── */

function PresetCard({
  config,
  workspaceId,
  onDelete,
}: {
  config: BuildConfig;
  workspaceId: string;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();

  const triggerMutation = useMutation({
    mutationFn: () => buildsApi.triggerBuild(workspaceId, { configId: config.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.runs(workspaceId) });
    },
  });

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-card hover:bg-muted/20 transition-colors">
      <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{config.name}</span>
        <code className="text-xs text-muted-foreground font-mono block truncate">{config.command}</code>
      </div>
      {config.timeoutMs !== 300000 && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {Math.round(config.timeoutMs / 1000)}s timeout
        </span>
      )}
      <Button
        size="sm"
        onClick={() => triggerMutation.mutate()}
        disabled={triggerMutation.isPending}
      >
        {triggerMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        <span className="ml-1">Run</span>
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ── Run Row ── */

function RunRow({ run, expanded, onToggle }: { run: BuildRun; expanded: boolean; onToggle: () => void }) {
  const queryClient = useQueryClient();
  const isActive = run.status === "running" || run.status === "queued";

  const cancelMutation = useMutation({
    mutationFn: () => buildsApi.cancelRun(run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.runs(run.workspaceId) });
    },
  });

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        {statusIcon(run.status)}
        <code className="text-xs font-mono truncate flex-1">{run.command}</code>
        <span className="text-xs text-muted-foreground shrink-0">{formatDuration(run.startedAt, run.finishedAt)}</span>
        {run.exitCode !== null && (
          <span className={cn("text-xs shrink-0", run.exitCode === 0 ? "text-green-500" : "text-destructive")}>
            exit {run.exitCode}
          </span>
        )}
        <Badge variant={statusBadgeVariant(run.status)} className="text-[10px] shrink-0">
          {run.status}
        </Badge>
        <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">{formatTime(run.createdAt)}</span>
        {isActive && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              cancelMutation.mutate();
            }}
          >
            <Square className="h-3 w-3" />
          </Button>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <BuildLogViewer buildRunId={run.id} status={run.status} />
          {run.error && (
            <p className="text-xs text-destructive mt-2">{run.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Workspace Section ── */

function WorkspaceBuildSection({
  workspace,
}: {
  workspace: { id: string; name: string; cwd: string | null; isPrimary: boolean };
}) {
  const queryClient = useQueryClient();
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [adHocCommand, setAdHocCommand] = useState("");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const { data: configs } = useQuery({
    queryKey: queryKeys.builds.configs(workspace.id),
    queryFn: () => buildsApi.listConfigs(workspace.id),
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.builds.runs(workspace.id),
    queryFn: () => buildsApi.listRuns(workspace.id),
    refetchInterval: (query) => {
      const data = query.state.data as BuildRun[] | undefined;
      return data?.some((r) => r.status === "running" || r.status === "queued") ? 3000 : false;
    },
  });

  // Auto-expand new running builds
  useEffect(() => {
    const active = runs?.find((r) => r.status === "running");
    if (active && !expandedRunId) {
      setExpandedRunId(active.id);
    }
  }, [runs, expandedRunId]);

  const createMutation = useMutation({
    mutationFn: () => buildsApi.createConfig(workspace.id, { name: newName, command: newCommand }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.configs(workspace.id) });
      setNewName("");
      setNewCommand("");
      setShowAddPreset(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => buildsApi.deleteConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.configs(workspace.id) });
    },
  });

  const adHocMutation = useMutation({
    mutationFn: () => buildsApi.triggerBuild(workspace.id, { command: adHocCommand }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.runs(workspace.id) });
      setAdHocCommand("");
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{workspace.name}</span>
        {workspace.isPrimary && (
          <Badge variant="secondary" className="text-[10px] font-normal">primary</Badge>
        )}
        <code className="text-[10px] text-muted-foreground font-mono ml-auto truncate max-w-[300px]">
          {workspace.cwd}
        </code>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Presets</h4>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAddPreset(!showAddPreset)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>

        {showAddPreset && (
          <div className="space-y-2 p-3 rounded-md border border-border bg-muted/10 mb-2">
            <input
              type="text"
              placeholder="Name (e.g. Build, Test, Lint)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full h-8 px-2 text-sm rounded-md border border-border bg-background"
            />
            <input
              type="text"
              placeholder="Command (e.g. npm run build)"
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              className="w-full h-8 px-2 text-sm rounded-md border border-border bg-background font-mono"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!newName.trim() || !newCommand.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAddPreset(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {configs && configs.length > 0 && (
          <div className="space-y-1.5">
            {configs.map((c) => (
              <PresetCard
                key={c.id}
                config={c}
                workspaceId={workspace.id}
                onDelete={() => deleteMutation.mutate(c.id)}
              />
            ))}
          </div>
        )}
        {configs && configs.length === 0 && !showAddPreset && (
          <p className="text-xs text-muted-foreground">No presets configured yet.</p>
        )}
      </div>

      {/* Ad-hoc */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ad-hoc Command</h4>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 border border-border rounded-md px-2 bg-background">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Run a command..."
              value={adHocCommand}
              onChange={(e) => setAdHocCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && adHocCommand.trim()) adHocMutation.mutate();
              }}
              className="flex-1 h-8 text-sm bg-transparent outline-none font-mono"
            />
          </div>
          <Button
            size="sm"
            disabled={!adHocCommand.trim() || adHocMutation.isPending}
            onClick={() => adHocMutation.mutate()}
          >
            {adHocMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span className="ml-1">Run</span>
          </Button>
        </div>
      </div>

      {/* Run history */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">History</h4>
        {runs && runs.length === 0 && (
          <p className="text-xs text-muted-foreground">No builds yet.</p>
        )}
        {runs && runs.length > 0 && (
          <div className="rounded-md border border-border overflow-hidden">
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                expanded={expandedRunId === run.id}
                onToggle={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */

export function BuildDeployProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const { data: project, isLoading } = useQuery({
    queryKey: queryKeys.projects.detail(projectId!),
    queryFn: () => projectsApi.get(projectId!, selectedCompanyId ?? undefined),
    enabled: !!projectId,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Build & Deploy", href: "/company/build-deploy" },
      { label: project?.name ?? "Project" },
    ]);
  }, [setBreadcrumbs, project]);

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (!project) return <p className="text-sm text-destructive">Project not found</p>;

  const workspacesWithCwd = project.workspaces.filter((w) => w.cwd);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-sm shrink-0"
          style={{ backgroundColor: project.color ?? "#6366f1" }}
        />
        <h1 className="text-lg font-bold">{project.name}</h1>
        <Badge variant="outline" className="text-[10px]">Build & Deploy</Badge>
      </div>

      {workspacesWithCwd.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This project has no workspaces with a local directory configured.
        </p>
      )}

      <div className="space-y-8">
        {workspacesWithCwd.map((workspace) => (
          <div key={workspace.id} className="rounded-md border border-border p-4">
            <WorkspaceBuildSection workspace={workspace} />
          </div>
        ))}
      </div>
    </div>
  );
}
