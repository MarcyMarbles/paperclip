import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BuildConfig, BuildRun, LiveEvent } from "@paperclipai/shared";
import { buildsApi } from "../api/builds";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn } from "../lib/utils";

/* ── Status helpers ── */

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    queued: { label: "Queued", variant: "secondary" },
    running: { label: "Running", variant: "default" },
    succeeded: { label: "Succeeded", variant: "outline" },
    failed: { label: "Failed", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "secondary" },
  };
  const entry = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

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

function formatDuration(start: Date | string | null, end: Date | string | null): string {
  if (!start) return "-";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/* ── Build Log Viewer ── */

function BuildLogViewer({ buildRunId, status }: { buildRunId: string; status: string }) {
  const [logContent, setLogContent] = useState("");
  const [nextOffset, setNextOffset] = useState(0);
  const scrollRef = useRef<HTMLPreElement>(null);
  const isActive = status === "running" || status === "queued";

  const fetchLog = useCallback(async () => {
    try {
      const result = await buildsApi.getRunLog(buildRunId, nextOffset);
      if (result.content) {
        setLogContent((prev) => prev + result.content);
      }
      if (result.nextOffset !== undefined) {
        setNextOffset(result.nextOffset);
      }
    } catch {
      // ignore log fetch errors
    }
  }, [buildRunId, nextOffset]);

  useEffect(() => {
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

  // Parse ndjson log lines
  const lines = logContent
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as { stream?: string; chunk?: string; ts?: string };
        return parsed.chunk ?? line;
      } catch {
        return line;
      }
    });

  return (
    <pre
      ref={scrollRef}
      className="bg-zinc-950 text-zinc-200 text-xs font-mono p-3 rounded-md overflow-auto max-h-[400px] whitespace-pre-wrap break-all"
    >
      {lines.length === 0 && isActive && (
        <span className="text-muted-foreground">Waiting for output...</span>
      )}
      {lines.length === 0 && !isActive && (
        <span className="text-muted-foreground">No output</span>
      )}
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </pre>
  );
}

/* ── Config Card ── */

function ConfigCard({
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
    <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-card">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{config.name}</div>
        <code className="text-xs text-muted-foreground font-mono truncate block">{config.command}</code>
      </div>
      <Button
        variant="default"
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
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ── Run Row ── */

function RunRow({ run }: { run: BuildRun }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => buildsApi.cancelRun(run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.runs(run.workspaceId) });
    },
  });

  const isActive = run.status === "running" || run.status === "queued";

  return (
    <div className="border border-border rounded-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {statusIcon(run.status)}
        <code className="text-xs font-mono truncate flex-1">{run.command}</code>
        <span className="text-xs text-muted-foreground">{formatDuration(run.startedAt, run.finishedAt)}</span>
        {run.exitCode !== null && (
          <span className={cn("text-xs", run.exitCode === 0 ? "text-green-500" : "text-destructive")}>
            exit {run.exitCode}
          </span>
        )}
        {statusBadge(run.status)}
        {isActive && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
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
        <div className="px-3 pb-3">
          <BuildLogViewer buildRunId={run.id} status={run.status} />
          {run.error && (
            <p className="text-xs text-destructive mt-2">{run.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Build Panel ── */

export function BuildPanel({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [adHocCommand, setAdHocCommand] = useState("");

  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: queryKeys.builds.configs(workspaceId),
    queryFn: () => buildsApi.listConfigs(workspaceId),
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: queryKeys.builds.runs(workspaceId),
    queryFn: () => buildsApi.listRuns(workspaceId),
    refetchInterval: (query) => {
      const data = query.state.data as BuildRun[] | undefined;
      const hasActive = data?.some((r) => r.status === "running" || r.status === "queued");
      return hasActive ? 3000 : false;
    },
  });

  const createConfigMutation = useMutation({
    mutationFn: () => buildsApi.createConfig(workspaceId, { name: newName, command: newCommand }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.configs(workspaceId) });
      setNewName("");
      setNewCommand("");
      setShowAddConfig(false);
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (configId: string) => buildsApi.deleteConfig(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.configs(workspaceId) });
    },
  });

  const adHocMutation = useMutation({
    mutationFn: () => buildsApi.triggerBuild(workspaceId, { command: adHocCommand }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.builds.runs(workspaceId) });
      setAdHocCommand("");
    },
  });

  return (
    <div className="space-y-6">
      {/* Build Configs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Build Configurations</h3>
          <Button variant="outline" size="sm" onClick={() => setShowAddConfig(!showAddConfig)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        {showAddConfig && (
          <div className="space-y-2 p-3 rounded-md border border-border bg-muted/10 mb-3">
            <input
              type="text"
              placeholder="Name (e.g. Build)"
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
                disabled={!newName.trim() || !newCommand.trim() || createConfigMutation.isPending}
                onClick={() => createConfigMutation.mutate()}
              >
                {createConfigMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAddConfig(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {configsLoading && <p className="text-sm text-muted-foreground">Loading configs...</p>}
        {configs && configs.length === 0 && !showAddConfig && (
          <p className="text-sm text-muted-foreground">No build configurations yet.</p>
        )}
        <div className="space-y-2">
          {configs?.map((config) => (
            <ConfigCard
              key={config.id}
              config={config}
              workspaceId={workspaceId}
              onDelete={() => deleteConfigMutation.mutate(config.id)}
            />
          ))}
        </div>
      </div>

      {/* Ad-hoc build */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Ad-hoc Build</h3>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 border border-border rounded-md px-2 bg-background">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Run a command..."
              value={adHocCommand}
              onChange={(e) => setAdHocCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && adHocCommand.trim()) {
                  adHocMutation.mutate();
                }
              }}
              className="flex-1 h-8 text-sm bg-transparent outline-none font-mono"
            />
          </div>
          <Button
            size="sm"
            disabled={!adHocCommand.trim() || adHocMutation.isPending}
            onClick={() => adHocMutation.mutate()}
          >
            {adHocMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span className="ml-1">Run</span>
          </Button>
        </div>
      </div>

      {/* Build History */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Build History</h3>
        {runsLoading && <p className="text-sm text-muted-foreground">Loading runs...</p>}
        {runs && runs.length === 0 && (
          <p className="text-sm text-muted-foreground">No builds have been run yet.</p>
        )}
        <div className="space-y-2">
          {runs?.map((run) => <RunRow key={run.id} run={run} />)}
        </div>
      </div>
    </div>
  );
}
