"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Download, FileArchive, XCircle } from "lucide-react";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { ApiClientError, api } from "@/lib/api-client";
import {
  type DataExportSnapshot,
  isExportInProgress,
} from "@/lib/export/snapshot";
import { formatBytes } from "@/lib/utils";

const POLL_INTERVAL_MS = 3000;
// Consecutive failed polls before giving up rather than spinning forever
const MAX_CONSECUTIVE_FAILURES = 5;

type ExportsResponse = { exports: DataExportSnapshot[] };
type RequestResponse = { export: DataExportSnapshot };

/** Completed but past its expiry — the archive is (or is about to be) deleted */
function isExpired(snapshot: DataExportSnapshot, now: Date): boolean {
  return (
    snapshot.status === "expired" ||
    (snapshot.status === "completed" &&
      snapshot.expiresAt !== null &&
      new Date(snapshot.expiresAt) <= now)
  );
}

export function ExportSettings({
  initialExports,
  available,
}: {
  initialExports: DataExportSnapshot[];
  /** False when the deployment has no background worker to build exports */
  available: boolean;
}) {
  const [exports, setExports] = useState(initialExports);
  const [isRequesting, setIsRequesting] = useState(false);
  const [pollError, setPollError] = useState(false);

  const inProgress = exports.some(({ status }) => isExportInProgress(status));

  useEffect(() => {
    if (!inProgress) return;
    let active = true;
    let failures = 0;
    setPollError(false);

    const timer = setInterval(async () => {
      try {
        const data = await api.get<ExportsResponse>("/api/v1/exports");
        if (!active) return;
        failures = 0;
        setExports(data.exports);
      } catch {
        if (!active) return;
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setPollError(true);
          clearInterval(timer);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [inProgress]);

  const handleExport = async () => {
    if (isRequesting || inProgress || !available) return;
    setIsRequesting(true);
    posthog.capture("data_export_submitted");
    try {
      const { export: created } =
        await api.post<RequestResponse>("/api/v1/exports");
      setExports((current) => [created, ...current]);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <>
      <section className="rounded-xl border p-6">
        <h3 className="flex items-center gap-2 font-semibold text-xl">
          <FileArchive className="size-5 text-muted-foreground" />
          Export your data
        </h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Download a copy of everything in your abode: every item with its tags,
          notes and highlights, your uploads, scans and saved images, your rooms
          and your profile. You get one file for moving to another abode, a
          Markdown file per item (ready for Obsidian), a bookmarks file for any
          browser, and your books as a Goodreads-style CSV.
        </p>
        <p className="mt-2 text-muted-foreground text-sm">
          Large libraries download in several parts — unzip them into the same
          folder.
        </p>

        {available ? (
          <Button
            className="mt-4"
            onClick={handleExport}
            disabled={isRequesting || inProgress}
          >
            {isRequesting ? (
              <IsLoading label="Starting" />
            ) : inProgress ? (
              "Export in progress…"
            ) : (
              "Export my data"
            )}
          </Button>
        ) : (
          <p className="mt-4 text-muted-foreground text-sm">
            Exporting isn't available on this deployment — it needs the
            background worker (Trigger.dev) to be configured.
          </p>
        )}

        {inProgress && (
          <p className="mt-3 text-muted-foreground text-xs">
            You can leave this page — your export keeps going and will be ready
            to download here.
          </p>
        )}
        {pollError && (
          <p className="mt-3 text-destructive text-sm">
            Couldn't check on your export. Refresh the page to see the latest.
          </p>
        )}
      </section>

      {exports.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 font-medium text-muted-foreground text-sm">
            Recent exports
          </h4>
          <div className="space-y-2">
            {exports.map((snapshot) => (
              <ExportRow key={snapshot.id} snapshot={snapshot} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ExportRow({ snapshot }: { snapshot: DataExportSnapshot }) {
  const now = new Date();
  const requested = formatDistanceToNow(new Date(snapshot.createdAt), {
    addSuffix: true,
  });
  const expired = isExpired(snapshot, now);
  const ready = snapshot.status === "completed" && !expired;
  const split = ready && snapshot.parts.length > 1;

  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-0.5 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            {ready && <CheckCircle2 className="size-4 text-emerald-600" />}
            {snapshot.status === "failed" && (
              <XCircle className="size-4 text-destructive" />
            )}
            {isExportInProgress(snapshot.status) ? (
              <IsLoading label="Preparing your export" />
            ) : ready ? (
              "Ready to download"
            ) : expired ? (
              "Expired"
            ) : (
              "Export failed"
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            Requested {requested}
            {ready && snapshot.itemCount !== null && (
              <>
                {" · "}
                {snapshot.itemCount}{" "}
                {snapshot.itemCount === 1 ? "item" : "items"}
              </>
            )}
            {ready && snapshot.fileCount !== null && (
              <>
                {" · "}
                {snapshot.fileCount}{" "}
                {snapshot.fileCount === 1 ? "file" : "files"}
              </>
            )}
            {ready && snapshot.sizeBytes !== null && (
              <> · {formatBytes(snapshot.sizeBytes)}</>
            )}
            {ready && snapshot.expiresAt && (
              <>
                {" · "}expires{" "}
                {formatDistanceToNow(new Date(snapshot.expiresAt), {
                  addSuffix: true,
                })}
              </>
            )}
          </p>
          {snapshot.status === "failed" && snapshot.error && (
            <p className="text-destructive text-xs">{snapshot.error}</p>
          )}
        </div>

        {ready && !split && <SingleDownloadButton snapshot={snapshot} />}
      </div>
      {split && <PartDownloadButtons snapshot={snapshot} />}
    </div>
  );
}

const downloadHref = (snapshot: DataExportSnapshot, position: number) =>
  `/api/v1/exports/${snapshot.id}/download?part=${position}`;

const trackDownload = (snapshot: DataExportSnapshot, position: number) =>
  posthog.capture("data_export_download_clicked", {
    part: position,
    part_count: snapshot.parts.length,
  });

function SingleDownloadButton({ snapshot }: { snapshot: DataExportSnapshot }) {
  return (
    <Button asChild size="sm" variant="outline">
      <a
        href={downloadHref(snapshot, 1)}
        onClick={() => trackDownload(snapshot, 1)}
      >
        <Download />
        Download
      </a>
    </Button>
  );
}

/** One button per part, under the details, for an export split into parts */
function PartDownloadButtons({ snapshot }: { snapshot: DataExportSnapshot }) {
  const count = snapshot.parts.length;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-muted-foreground text-xs">
        Download all {count} parts and unzip them into the same folder.
      </p>
      <div className="flex flex-wrap gap-2">
        {snapshot.parts.map(({ position, sizeBytes }) => (
          <Button key={position} asChild size="sm" variant="outline">
            <a
              href={downloadHref(snapshot, position)}
              onClick={() => trackDownload(snapshot, position)}
              aria-label={`Download part ${position} of ${count} (${formatBytes(sizeBytes)})`}
            >
              <Download />
              Part {position}
              <span className="text-muted-foreground">
                {formatBytes(sizeBytes)}
              </span>
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
