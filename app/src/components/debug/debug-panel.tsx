"use client";

import {
  Bug,
  ClipboardCopy,
  Flag,
  Minimize2,
  Pause,
  Play,
  Power,
  Trash2,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CHAIN_GAP_MS,
  formatTraceGap,
  formatTraceSummary,
  formatTraceTime,
} from "@/lib/debug/format";
import {
  TRACE_CHANNELS,
  type TraceChannel,
  type TraceEvent,
} from "@/lib/debug/trace";
import { cn } from "@/lib/utils";

const CHANNEL_STYLES: Record<TraceChannel, string> = {
  url: "bg-violet-500/20 text-violet-300",
  query: "bg-sky-500/20 text-sky-300",
  grid: "bg-blue-500/20 text-blue-300",
  dialog: "bg-emerald-500/20 text-emerald-300",
  layout: "bg-red-500/20 text-red-300",
  perf: "bg-amber-500/20 text-amber-300",
  mark: "bg-white/20 text-white",
};

/** Most recent rows rendered — keeps the panel itself from causing slow frames */
const MAX_ROWS = 250;

// Events that would otherwise reach a modal's document listeners: Radix Dialog
// closes on an outside pointerdown, traps focus on focusin, and react-remove-scroll
// blocks wheel/touch scrolling outside the dialog
const ISOLATED_EVENTS = [
  "pointerdown",
  "mousedown",
  "focusin",
  "wheel",
  "touchstart",
  "touchmove",
] as const;

export type DebugPanelProps = {
  events: readonly TraceEvent[];
  paused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
  onCopy: () => void;
  onMark: () => void;
  /** Turn the debug tools off entirely (clears the persisted flag) */
  onDisable: () => void;
  defaultExpanded?: boolean;
};

/**
 * Floating admin overlay showing the debug trace timeline. Rows closer than
 * {@link CHAIN_GAP_MS} to the previous one are grouped visually, since those
 * are usually one causal chain (URL write → list refetch → dialog remount).
 */
export function DebugPanel({
  events,
  paused,
  onTogglePause,
  onClear,
  onCopy,
  onMark,
  onDisable,
  defaultExpanded = true,
}: DebugPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hidden, setHidden] = useState<Set<TraceChannel>>(() => new Set());
  const [openRowId, setOpenRowId] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stop = (event: Event) => event.stopPropagation();
    for (const type of ISOLATED_EVENTS) root.addEventListener(type, stop);
    return () => {
      for (const type of ISOLATED_EVENTS) root.removeEventListener(type, stop);
    };
  }, []);

  const visible = useMemo(
    () => events.filter((event) => !hidden.has(event.channel)).slice(-MAX_ROWS),
    [events, hidden],
  );

  const counts = useMemo(() => {
    const byChannel = new Map<TraceChannel, number>();
    for (const event of events) {
      byChannel.set(event.channel, (byChannel.get(event.channel) ?? 0) + 1);
    }
    return byChannel;
  }, [events]);

  // Follow new events unless the user has scrolled up to read (every render —
  // a no-op unless the list grew)
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickToBottomRef.current) list.scrollTop = list.scrollHeight;
  });

  const toggleChannel = (channel: TraceChannel) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  };

  return (
    <div
      ref={rootRef}
      data-debug-panel
      // Above any modal overlay; pointer-events re-enabled because an open
      // Radix modal sets pointer-events:none on <body>. Inset from the left to
      // clear the Next.js dev tools badge
      className="pointer-events-auto fixed bottom-3 left-16 z-[2147483647] font-mono text-[11px] text-neutral-100"
    >
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 rounded-full bg-neutral-900/90 px-3 py-1.5 shadow-lg ring-1 ring-white/10 backdrop-blur"
        >
          <Bug className="size-3.5" />
          <span className={cn(paused && "text-amber-300")}>
            {paused ? "paused" : "tracing"}
          </span>
          <span className="text-neutral-400">{events.length}</span>
        </button>
      ) : (
        <div className="flex h-[min(24rem,60vh)] w-[min(34rem,calc(100vw-5rem))] flex-col overflow-hidden rounded-lg bg-neutral-900/95 shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center gap-1 border-white/10 border-b px-2 py-1.5">
            <Bug className="size-3.5 shrink-0" />
            <span className="mr-auto font-semibold">Debug trace</span>
            <PanelButton label="Mark (drop a marker)" onClick={onMark}>
              <Flag />
            </PanelButton>
            <PanelButton
              label={paused ? "Resume" : "Pause"}
              onClick={onTogglePause}
            >
              {paused ? <Play /> : <Pause />}
            </PanelButton>
            <PanelButton label="Clear" onClick={onClear}>
              <Trash2 />
            </PanelButton>
            <PanelButton label="Copy trace as JSON" onClick={onCopy}>
              <ClipboardCopy />
            </PanelButton>
            <PanelButton label="Minimise" onClick={() => setExpanded(false)}>
              <Minimize2 />
            </PanelButton>
            <PanelButton label="Turn debug tools off" onClick={onDisable}>
              <Power />
            </PanelButton>
          </div>
          <div className="flex flex-wrap gap-1 border-white/10 border-b px-2 py-1.5">
            {TRACE_CHANNELS.map((channel) => (
              <button
                key={channel}
                type="button"
                aria-pressed={!hidden.has(channel)}
                onClick={() => toggleChannel(channel)}
                className={cn(
                  "rounded px-1.5 py-0.5",
                  CHANNEL_STYLES[channel],
                  hidden.has(channel) && "line-through opacity-40",
                )}
              >
                {channel} {counts.get(channel) ?? 0}
              </button>
            ))}
          </div>
          <div
            ref={listRef}
            role="log"
            aria-label="Debug trace events"
            className="flex-1 overflow-y-auto overscroll-contain py-1"
            onScroll={(event) => {
              const el = event.currentTarget;
              stickToBottomRef.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
          >
            {visible.length === 0 ? (
              <p className="px-2 py-4 text-center text-neutral-400">
                {paused ? "Paused." : "Waiting for events…"}
              </p>
            ) : (
              visible.map((event, index) => {
                const gap = index > 0 ? event.t - visible[index - 1].t : null;
                const chained = gap !== null && gap < CHAIN_GAP_MS;
                const isOpen = openRowId === event.id;
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "border-l-2 px-2",
                      chained ? "border-transparent" : "mt-1 border-white/20",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenRowId(isOpen ? null : event.id)}
                      className="flex w-full items-baseline gap-2 py-0.5 text-left hover:bg-white/5"
                    >
                      <span className="w-14 shrink-0 text-neutral-500 tabular-nums">
                        {formatTraceTime(event.t)}
                      </span>
                      <span
                        className={cn(
                          "w-12 shrink-0 text-right tabular-nums",
                          chained ? "text-amber-300" : "text-neutral-500",
                        )}
                      >
                        {formatTraceGap(gap)}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1",
                          CHANNEL_STYLES[event.channel],
                        )}
                      >
                        {event.channel}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {event.event}
                      </span>
                      <span className="truncate text-neutral-400">
                        {formatTraceSummary(event.data)}
                      </span>
                    </button>
                    {isOpen && event.data && (
                      <pre className="my-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 text-neutral-300">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PanelButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="size-6 text-neutral-300 hover:bg-white/10 hover:text-white [&_svg]:size-3.5"
    >
      {children}
    </Button>
  );
}
