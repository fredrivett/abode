"use client";

import {
  type ComponentProps,
  lazy,
  Suspense,
  useState,
  useSyncExternalStore,
} from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NoteEditor } from "./note-editor";

const loadNoteEditor = () =>
  import("./note-editor").then((mod) => ({ default: mod.NoteEditor }));

const subscribe = () => () => {};

/**
 * Stand-in while the editor downloads: the content as plain text, so a saved
 * draft is readable straight away on a slow connection rather than blank (an
 * empty composer shows its own placeholder)
 */
function DraftPreview({
  content,
  className,
}: ComponentProps<typeof NoteEditor>) {
  if (!content) return null;
  return (
    <div
      aria-busy="true"
      className={cn("whitespace-pre-wrap text-muted-foreground", className)}
    >
      {content}
    </div>
  );
}

/**
 * {@link NoteEditor}, code-split so Tiptap/ProseMirror stays out of the
 * first-load bundle of pages that show it straight away (the dashboard's note
 * composer). Client-only, like the editor itself (`immediatelyRender: false`).
 * While it downloads the content shows as plain text; a failed download
 * (e.g. patchy mobile data) shows a retry: `lazy` caches a
 * rejected import forever, so retrying means a fresh `lazy` (as the scanner).
 */
export function LazyNoteEditor(props: ComponentProps<typeof NoteEditor>) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [attempt, setAttempt] = useState(0);
  const [Editor, setEditor] = useState(() => lazy(loadNoteEditor));

  if (!isClient) return null;

  const retry = () => {
    setEditor(() => lazy(loadNoteEditor));
    setAttempt((current) => current + 1);
  };

  return (
    <ErrorBoundary
      key={attempt}
      fallback={
        <Button variant="ghost" size="sm" onClick={retry}>
          Couldn't load the editor. Retry
        </Button>
      }
    >
      <Suspense fallback={<DraftPreview {...props} />}>
        <Editor {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
