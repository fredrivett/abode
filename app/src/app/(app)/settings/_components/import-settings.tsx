"use client";

import { BookDown, CheckCircle2, XCircle } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ApiClientError, api } from "@/lib/api-client";
import { type ImportSnapshot, useImportPoll } from "@/lib/use-import-poll";

type ImportResponse = { importId: string; total: number };

export function ImportSettings({
  initialImport,
}: {
  initialImport: ImportSnapshot | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importId, setImportId] = useState<string | null>(
    initialImport?.id ?? null,
  );

  const { status, error: pollError } = useImportPoll(importId, initialImport);
  // In progress from the moment an import id is set until a terminal status
  // arrives — including the gap before the first poll — so the form can't be
  // resubmitted during an active run. If polling can't confirm the status
  // (repeated failures), re-enable the form so the user isn't stuck.
  const inProgress =
    importId != null &&
    !pollError &&
    status?.status !== "completed" &&
    status?.status !== "failed";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || isSubmitting || inProgress) return;

    setIsSubmitting(true);
    posthog.capture("book_import_submitted", { source: "literal" });
    try {
      const { importId: newId } = await api.post<ImportResponse>(
        "/api/v1/imports/literal",
        { email: email.trim(), password },
      );
      setImportId(newId);
      setPassword("");
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Something went wrong. Please try again.";
      toast.error(message);
      posthog.capture("book_import_connect_failed", {
        source: "literal",
        status: error instanceof ApiClientError ? error.status : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border p-6">
      <div className="flex items-center gap-2">
        <BookDown className="size-5 text-muted-foreground" />
        <h3 className="font-medium text-lg">Import from Literal</h3>
      </div>
      <p className="mt-1 text-muted-foreground text-sm">
        Bring your library across from literal.club. We use your login once to
        fetch your books and never store your password.
      </p>

      {status && <ImportProgress status={status} />}

      {pollError && (
        <p className="mt-4 text-destructive text-sm">
          Couldn't check the import's status. It may still be running — refresh
          the page to see the latest.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="literal-email">Literal email</Label>
          <Input
            id="literal-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting || inProgress}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="literal-password">Literal password</Label>
          <Input
            id="literal-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting || inProgress}
          />
        </div>
        <Button
          type="submit"
          disabled={isSubmitting || inProgress || !email.trim() || !password}
        >
          {isSubmitting ? (
            <IsLoading label="Connecting" />
          ) : inProgress ? (
            "Import in progress…"
          ) : (
            "Import my books"
          )}
        </Button>
      </form>
    </section>
  );
}

function ImportProgress({ status }: { status: ImportSnapshot }) {
  const done = status.importedCount + status.skippedCount + status.failedCount;
  const value =
    status.totalCount > 0 ? Math.round((done / status.totalCount) * 100) : 100;
  const inProgress =
    status.status === "importing" || status.status === "pending";

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {status.status === "completed" && (
            <CheckCircle2 className="size-4 text-emerald-600" />
          )}
          {status.status === "failed" && (
            <XCircle className="size-4 text-destructive" />
          )}
          {status.status === "completed"
            ? "Import complete"
            : status.status === "failed"
              ? "Import failed"
              : "Importing your library…"}
        </span>
        <span className="text-muted-foreground">
          {done} / {status.totalCount}
        </span>
      </div>

      {inProgress && <Progress value={value} className="mt-3" />}

      <p className="mt-2 text-muted-foreground text-xs">
        {status.status === "failed"
          ? (status.error ?? "The import couldn't be completed. Try again.")
          : `${status.importedCount} imported${
              status.skippedCount > 0
                ? `, ${status.skippedCount} already in your library`
                : ""
            }${status.failedCount > 0 ? `, ${status.failedCount} failed` : ""}.`}
      </p>
    </div>
  );
}
