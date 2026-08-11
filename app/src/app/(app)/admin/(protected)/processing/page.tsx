import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateTime } from "@/components/ui/date-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProcessingIssues,
  type IssueGroup,
} from "@/lib/admin/processing-issues";
import { REPROCESS_LIMIT } from "@/lib/admin/reprocess-issues";
import { ReprocessButton } from "../../_components/reprocess-button";

export const metadata = {
  title: "Processing | Admin | abode",
};

function itemLabel(item: IssueGroup["items"][number]): string {
  return item.title?.trim() || item.sourceUrl || item.id;
}

function IssueSection({ group }: { group: IssueGroup }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{group.label}</CardTitle>
              <Badge
                variant={
                  group.severity === "error" ? "destructive" : "secondary"
                }
              >
                {group.count}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              {group.description}
            </CardDescription>
          </div>
          {group.count > 0 && (
            <ReprocessButton
              groupKey={group.key}
              label={group.label}
              count={group.count}
              limit={REPROCESS_LIMIT}
              repair={group.repair}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {group.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">None ✓</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Kind</TableHead>
                <TableHead>Item</TableHead>
                {group.key === "failed" && (
                  <TableHead className="w-40">Reason</TableHead>
                )}
                <TableHead className="w-44">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {item.kind ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    <Link
                      href={`/admin/items/${item.id}`}
                      className="hover:underline"
                    >
                      {itemLabel(item)}
                    </Link>
                  </TableCell>
                  {group.key === "failed" && (
                    <TableCell className="text-muted-foreground text-xs">
                      {item.processingError ?? "unknown"}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground text-xs">
                    <DateTime date={item.updatedAt} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {group.count > group.items.length && (
          <p className="mt-3 text-muted-foreground text-xs">
            Showing the {group.items.length} most recent of {group.count}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminProcessingPage() {
  const groups = await getProcessingIssues();
  const errorTotal = groups
    .filter((g) => g.severity === "error")
    .reduce((sum, g) => sum + g.count, 0);
  const incompleteTotal = groups
    .filter((g) => g.severity === "incomplete")
    .reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>

        <header>
          <h2 className="font-semibold text-2xl tracking-tight">
            Processing issues
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Items in a bad state right now — failed, stuck, or completed but
            missing data they should have. Derived live from item state, newest
            first.
          </p>
          <div className="mt-3 flex gap-2">
            <Badge variant="destructive">{errorTotal} errors</Badge>
            <Badge variant="secondary">{incompleteTotal} incomplete</Badge>
          </div>
        </header>

        <div className="mt-8 space-y-6">
          {groups.map((group) => (
            <IssueSection key={group.key} group={group} />
          ))}
        </div>
      </div>
    </div>
  );
}
