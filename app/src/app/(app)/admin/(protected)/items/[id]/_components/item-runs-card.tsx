import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TreeIndent } from "@/components/ui/tree-indent";
import type { ItemRun } from "@/lib/trigger/item-runs";
import { cn } from "@/lib/utils";

/** A run plus its dashboard deep-link and tree indent, ready to render. */
export type ItemRunRow = ItemRun & { href: string | null; indent: number };

export type ItemRunsCardProps = {
  result:
    | { state: "not_configured" }
    | { state: "error" }
    | { state: "ok"; runs: ItemRunRow[] };
};

function statusClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "bg-emerald-500/10 text-emerald-600";
  if (
    ["FAILED", "CRASHED", "TIMED_OUT", "CANCELED", "SYSTEM_FAILURE"].includes(s)
  )
    return "bg-destructive/10 text-destructive";
  if (
    [
      "EXECUTING",
      "QUEUED",
      "WAITING",
      "REATTEMPTING",
      "DELAYED",
      "FROZEN",
    ].includes(s)
  )
    return "bg-amber-500/10 text-amber-600";
  return "bg-muted text-muted-foreground";
}

function formatDuration(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cents: number): string {
  if (!cents) return "—";
  return `$${(cents / 100).toFixed(4)}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString();
}

export function ItemRunsCard({ result }: ItemRunsCardProps) {
  // Not configured → the integration is off; render nothing (no empty card)
  if (result.state === "not_configured") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trigger runs</CardTitle>
      </CardHeader>
      <CardContent>
        {result.state === "error" ? (
          <p className="text-muted-foreground text-sm">
            Couldn't load runs from Trigger.
          </p>
        ) : result.runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No runs found for this item (only runs created after tagging shipped
            are listed).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Task</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Cost</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {result.runs.map((run) => (
                  <tr key={run.id} className="border-border/60 border-t">
                    <td className="py-2 pr-4 font-mono text-xs">
                      <span className="flex items-center">
                        <TreeIndent depth={run.indent} />
                        {run.taskIdentifier}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 font-medium text-xs",
                          statusClass(run.status),
                        )}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {formatDate(run.createdAt)}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {formatDuration(run.durationMs)}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {formatCost(run.costInCents)}
                    </td>
                    <td className="py-2">
                      {run.href && (
                        <a
                          href={run.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          aria-label={`Open run ${run.id} in Trigger`}
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
