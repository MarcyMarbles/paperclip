import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { projectsApi } from "../api/projects";
import { buildsApi, type BuildRunWithContext } from "../api/builds";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Hammer,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Square,
  Filter,
} from "lucide-react";
import { cn } from "../lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

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

function BuildRunRow({ run }: { run: BuildRunWithContext }) {
  return (
    <Link
      to={`/company/build-deploy/${run.projectId}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border last:border-b-0"
    >
      {statusIcon(run.status)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono truncate max-w-[320px]">{run.command}</code>
          <Badge variant={statusBadgeVariant(run.status)} className="text-[10px] shrink-0">
            {run.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: run.projectColor ?? "#6366f1" }}
            />
            {run.projectName}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span>{run.workspaceName}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
        {run.exitCode !== null && (
          <span className={cn(run.exitCode === 0 ? "text-green-500" : "text-destructive")}>
            exit {run.exitCode}
          </span>
        )}
        <span className="w-16 text-right">{formatDuration(run.startedAt, run.finishedAt)}</span>
        <span className="w-20 text-right">{formatTime(run.createdAt)}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}

function ProjectCard({
  project,
}: {
  project: { id: string; name: string; color: string | null; workspaceCount: number; runningCount: number; lastRunStatus: string | null };
}) {
  return (
    <Link
      to={`/company/build-deploy/${project.id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-md border border-border hover:bg-muted/30 transition-colors"
    >
      <div
        className="w-3 h-3 rounded-sm shrink-0"
        style={{ backgroundColor: project.color ?? "#6366f1" }}
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{project.name}</span>
        <p className="text-xs text-muted-foreground">
          {project.workspaceCount} workspace{project.workspaceCount !== 1 ? "s" : ""}
        </p>
      </div>
      {project.runningCount > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{project.runningCount} running</span>
        </span>
      )}
      {project.lastRunStatus && project.runningCount === 0 && (
        <span className="flex items-center gap-1">
          {statusIcon(project.lastRunStatus)}
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}

export function BuildDeploy() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Build & Deploy" }]);
  }, [setBreadcrumbs]);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: allRuns, isLoading: runsLoading } = useQuery({
    queryKey: queryKeys.builds.allRuns(selectedCompanyId!, statusFilter || undefined),
    queryFn: () => buildsApi.listAllRuns(selectedCompanyId!, {
      status: statusFilter || undefined,
      limit: 100,
    }),
    enabled: !!selectedCompanyId,
    refetchInterval: (query) => {
      const data = query.state.data as BuildRunWithContext[] | undefined;
      const hasActive = data?.some((r) => r.status === "running" || r.status === "queued");
      return hasActive ? 3000 : false;
    },
  });

  const projectsWithWorkspaces = useMemo(
    () => (projects ?? []).filter((p) => p.workspaces.some((w) => w.cwd)),
    [projects],
  );

  const projectCards = useMemo(() => {
    return projectsWithWorkspaces.map((p) => {
      const projectRuns = (allRuns ?? []).filter((r) => r.projectId === p.id);
      const runningCount = projectRuns.filter((r) => r.status === "running" || r.status === "queued").length;
      const lastRun = projectRuns[0] ?? null;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        workspaceCount: p.workspaces.filter((w) => w.cwd).length,
        runningCount,
        lastRunStatus: lastRun?.status ?? null,
      };
    });
  }, [projectsWithWorkspaces, allRuns]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Hammer} message="Select a company to view builds" />;
  }

  if (projectsLoading) return <PageSkeleton variant="list" />;

  if (projectsWithWorkspaces.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Build & Deploy</h1>
        <EmptyState
          icon={Hammer}
          message="No projects with local workspaces. Add a local directory to a project to start building."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Build & Deploy</h1>

      {/* Projects grid */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {projectCards.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </div>

      {/* Recent builds list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Builds</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {runsLoading && <PageSkeleton variant="list" />}

        {!runsLoading && allRuns && allRuns.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            {statusFilter ? "No builds matching this filter." : "No builds have been run yet."}
          </div>
        )}

        {allRuns && allRuns.length > 0 && (
          <div className="rounded-md border border-border overflow-hidden">
            {allRuns.map((run) => (
              <BuildRunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
