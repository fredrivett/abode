"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import posthog from "posthog-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MAX_DOCUMENT_PAGES } from "@/lib/documents/create-document-schema";
import { createLogger } from "@/lib/logger.client";
import type { ScanFilter } from "@/lib/scanner/filters";
import type { Quad } from "@/lib/scanner/geometry";
import {
  type FinishedScanPage,
  pagesReducer,
  previewKey,
  type ScanPage,
} from "@/lib/scanner/pages";
import { ScannerClient } from "@/lib/scanner/scanner-client";
import {
  type CameraCapture,
  ScannerCamera,
  type ScreenRect,
} from "./scanner-camera";
import { ScannerLoadError } from "./scanner-load-error";
import { type PageFlight, ScannerReview } from "./scanner-review";
import { usePagePreviews } from "./use-page-previews";

const log = createLogger("scanner/document-scanner");

/** Imported photos are downscaled to this long edge before scanning */
const IMPORT_MAX_DIMENSION = 3000;
/** Matches the filtered page's fade-in over the colour one after a flight */
const CROSSFADE_MS = 550;

interface PageCapture {
  frame: ImageData;
  hint: Quad | null;
  fromRect: ScreenRect | null;
  mode: CameraCapture["mode"] | "import";
}

type SaveScannedPages = (
  pages: AsyncIterable<FinishedScanPage>,
  options: { pageCount: number },
) => Promise<boolean>;

interface DocumentScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Persists the pages, rendered lazily as it iterates, and reports its own
   * errors; the scanner closes when it resolves true
   */
  onSave: SaveScannedPages;
}

/** Full-screen multi-page document scanner (camera → review → save) */
export function DocumentScanner({
  open,
  onOpenChange,
  onSave,
}: DocumentScannerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {open ? (
          <ScannerSession onClose={() => onOpenChange(false)} onSave={onSave} />
        ) : null}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

async function decodePhoto(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    IMPORT_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** One open scanner — remounted per open so every scan starts fresh */
function ScannerSession({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: SaveScannedPages;
}) {
  const [client, setClient] = useState<ScannerClient | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  // Bumped to retry a failed load with a fresh worker (the old one's failed import stays cached)
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pages, dispatch] = useReducer(pagesReducer, []);
  const [view, setView] = useState<"camera" | "review">("camera");
  const [retakeId, setRetakeId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const capturingRef = useRef(false);
  const [flight, setFlight] = useState<PageFlight | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [auto, setAuto] = useLocalStorage("abode:scanner-auto", true);
  const [defaultFilter, setDefaultFilter] = useState<ScanFilter>("bw");
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadAttempt re-runs the load on retry
  useEffect(() => {
    const scanner = ScannerClient.create();
    const controller = new AbortController();
    setClient(scanner);
    setLoadStatus("loading");
    scanner.init().then(
      (detector) => {
        if (controller.signal.aborted) return;
        setLoadStatus("ready");
        if (detector === "classical") {
          log.warn("ML detector failed to load; using classical detection");
        }
      },
      (error: unknown) => {
        // Closing the scanner (or a StrictMode remount) rejects the pending init
        if (controller.signal.aborted) return;
        log.error({ error }, "Scanner failed to load");
        posthog.captureException(error);
        setLoadStatus("failed");
      },
    );
    return () => {
      controller.abort();
      scanner.terminate();
    };
  }, [loadAttempt]);

  const previewRequests = useMemo(
    () => [
      ...pages.map((page) => ({ page, filter: page.filter })),
      // The colour preview is what flies in from the camera
      ...pages
        .filter((page) => page.id === flight?.pageId)
        .map((page) => ({ page, filter: "original" as const })),
    ],
    [pages, flight?.pageId],
  );
  const { previews, failed, retry, seed } = usePagePreviews({
    client,
    requests: previewRequests,
  });

  // After a flight lands, drop the colour layer once the filtered page has faded in
  useEffect(() => {
    if (!flight || landedId !== flight.pageId) return;
    const page = pages.find((p) => p.id === flight.pageId);
    if (page && !previews.has(previewKey({ page }))) return;
    const timer = setTimeout(() => setFlight(null), CROSSFADE_MS);
    return () => clearTimeout(timer);
  }, [flight, landedId, pages, previews]);

  /**
   * Adds (or retakes) a page. Takes the capture lock before any async work —
   * including decoding an imported photo — so a camera auto-capture and an
   * import can't race and silently drop one of them. `getCapture` resolving
   * to null aborts quietly (it reported its own error).
   */
  const addPage = useCallback(
    async (getCapture: () => Promise<PageCapture | null> | PageCapture) => {
      if (!client || capturingRef.current) return;
      capturingRef.current = true;
      setCapturing(true);
      try {
        const capture = await getCapture();
        if (!capture) return;
        const { frame, hint, fromRect, mode } = capture;
        const { source, quad } = await client.capture({ frame, hint });
        // A retake keeps the page's filter; new pages use the last one chosen
        const retaken = pages.find((page) => page.id === retakeId);
        const page: ScanPage = {
          id: crypto.randomUUID(),
          source,
          quad,
          rotation: 0,
          filter: retaken?.filter ?? defaultFilter,
        };
        if (fromRect) {
          // Render the colour page up front so the flight starts immediately
          seed({
            page,
            filter: "original",
            rendered: await client.render({ ...page, filter: "original" }),
          });
          setFlight({ pageId: page.id, from: fromRect });
        }
        dispatch(
          retakeId
            ? { type: "replace", id: retakeId, page }
            : { type: "add", page },
        );
        setRetakeId(null);
        setActiveId(page.id);
        setView("review");
        posthog.capture("document_scan_page_captured", {
          mode,
          detected: quad !== null,
          retake: retakeId !== null,
        });
      } catch (error) {
        log.error({ error }, "Failed to capture page");
        posthog.captureException(error);
        toast.error("Couldn't capture that page. Please try again.");
      } finally {
        capturingRef.current = false;
        setCapturing(false);
      }
    },
    [client, defaultFilter, pages, retakeId, seed],
  );

  const importPhoto = (file: File) =>
    addPage(async () => {
      try {
        const frame = await decodePhoto(file);
        return { frame, hint: null, fromRect: null, mode: "import" };
      } catch (error) {
        log.warn({ error }, "Failed to import photo");
        toast.error("Couldn't open that photo. Try a JPEG or PNG.");
        return null;
      }
    });

  const deletePage = (id: string) => {
    const index = pages.findIndex((page) => page.id === id);
    const remaining = pages.filter((page) => page.id !== id);
    dispatch({ type: "remove", id });
    if (remaining.length === 0) {
      setActiveId(null);
      setView("camera");
      return;
    }
    setActiveId(remaining[Math.min(index, remaining.length - 1)].id);
  };

  const leaveCamera = () => {
    if (pages.length === 0) {
      onClose();
      return;
    }
    setRetakeId(null);
    setView("review");
  };

  const cancel = () => {
    if (view === "camera") {
      leaveCamera();
    } else if (pages.length > 0) {
      setConfirmingDiscard(true);
    } else {
      onClose();
    }
  };

  /** Renders each page as it's asked for, so they're never all in memory */
  async function* renderFinishedPages(
    scanner: ScannerClient,
  ): AsyncGenerator<FinishedScanPage> {
    for (const page of pages) {
      const image = await scanner.render(page);
      const original =
        page.filter === "original"
          ? null
          : await scanner.render({ ...page, filter: "original" });
      yield {
        image: image.blob,
        original: original?.blob ?? null,
        filter: page.filter,
        width: image.width,
        height: image.height,
      };
    }
  }

  const save = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const saved = await onSave(renderFinishedPages(client), {
        pageCount: pages.length,
      });
      if (saved) {
        posthog.capture("document_scan_saved", { page_count: pages.length });
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Content
      className="fixed inset-0 z-50 h-dvh w-screen bg-black outline-none"
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        if (!confirmingDiscard) cancel();
      }}
    >
      <DialogPrimitive.Title className="sr-only">
        Scan a document
      </DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">
        Point your camera at a document to scan it, one page at a time.
      </DialogPrimitive.Description>

      <div className={view === "camera" ? "absolute inset-0" : "hidden"}>
        <ScannerCamera
          client={client}
          ready={loadStatus === "ready"}
          active={view === "camera"}
          capturing={capturing}
          auto={auto}
          onAutoChange={setAuto}
          onCapture={(capture) => addPage(() => capture)}
          onImport={importPhoto}
          onClose={leaveCamera}
          closeLabel={pages.length > 0 ? "Back to pages" : "Close scanner"}
        />
      </div>

      {view === "review" ? (
        <div className="absolute inset-0">
          <ScannerReview
            pages={pages}
            previews={previews}
            failedPreviews={failed}
            onRetryPreview={(page) => retry({ page, filter: page.filter })}
            activeId={activeId}
            onActiveChange={setActiveId}
            flight={flight}
            onFlightEnd={() => setLandedId(flight?.pageId ?? null)}
            canAddPage={pages.length < MAX_DOCUMENT_PAGES}
            onAddPage={() => {
              setRetakeId(null);
              setView("camera");
            }}
            onRetake={(id) => {
              setRetakeId(id);
              setView("camera");
            }}
            onDelete={deletePage}
            onRotate={(id) => dispatch({ type: "rotate", id })}
            onFilterChange={({ id, filter }) => {
              dispatch({ type: "set-filter", id, filter });
              setDefaultFilter(filter);
            }}
            onMove={({ id, to }) => dispatch({ type: "move", id, to })}
            onCancel={cancel}
            onSave={save}
            saving={saving}
          />
        </div>
      ) : null}

      {loadStatus === "failed" ? (
        <ScannerLoadError
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
          onClose={onClose}
        />
      ) : null}

      <AlertDialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this scan?</AlertDialogTitle>
            <AlertDialogDescription>
              {pages.length === 1
                ? "The page you scanned will be lost."
                : `The ${pages.length} pages you scanned will be lost.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep scanning</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogPrimitive.Content>
  );
}
