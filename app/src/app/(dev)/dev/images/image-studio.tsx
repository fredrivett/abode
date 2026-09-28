"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createDesign } from "./actions";
import { Artboard, useDesignTheme } from "./artboard";
import { type Design, defaultDesign, type SavedDesign } from "./design";
import { DesignEditor } from "./design-editor";
import { type FormatId, getFormat, IMAGE_FORMATS, isFormatId } from "./formats";

type DesignSummary = { slug: string; name: string };

/** Picks, creates and edits the saved image designs */
export function ImageStudio({
  designs,
  active,
  renderOnly,
}: {
  designs: DesignSummary[];
  active: SavedDesign | null;
  renderOnly: boolean;
}) {
  const router = useRouter();

  if (renderOnly) {
    return active ? <RenderView design={active.design} /> : null;
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {designs.length > 0 && (
        <select
          aria-label="Image"
          value={active?.slug}
          onChange={(e) => router.push(`?design=${e.currentTarget.value}`)}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          {designs.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      )}
      <NewDesignButton />
    </div>
  );

  if (!active) {
    return (
      <div className="min-h-screen space-y-3 bg-muted/30 p-4">
        {toolbar}
        <p className="text-muted-foreground text-sm">
          No images yet — create one to get started.
        </p>
      </div>
    );
  }

  return (
    <DesignEditor
      key={active.slug}
      slug={active.slug}
      initial={active.design}
      toolbar={toolbar}
    />
  );
}

/** Bare artboard at its native size — what exportDesignImage screenshots */
function RenderView({ design }: { design: Design }) {
  useDesignTheme(design.theme);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Keep Next's dev badge out of the screenshot */}
      <style>{"nextjs-portal { display: none !important; }"}</style>
      <Artboard design={design} />
    </div>
  );
}

function NewDesignButton() {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState<FormatId>("x-header");
  const [size, setSize] = useState(() => {
    const { width, height } = getFormat("x-header");
    return { width, height };
  });
  const [creating, setCreating] = useState(false);
  const format = getFormat(formatId);

  const create = async () => {
    setCreating(true);
    try {
      const result = await createDesign(
        defaultDesign({
          name: name.trim() || format.label,
          format: formatId,
          ...size,
        }),
      );
      if (!result.slug) {
        toast.error(`Couldn't create: ${result.error ?? "unknown error"}`);
        return;
      }
      setOpen(false);
      setName("");
      router.push(`?design=${result.slug}`);
    } catch (error) {
      toast.error(
        `Couldn't create: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus />
          New image
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 text-sm">
        <div className="space-y-1">
          <label htmlFor={`${id}-name`}>Name</label>
          <Input
            id={`${id}-name`}
            value={name}
            placeholder={format.label}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-format`}>Size</label>
          <select
            id={`${id}-format`}
            value={formatId}
            onChange={(e) => {
              const next = e.currentTarget.value;
              if (!isFormatId(next)) return;
              setFormatId(next);
              const { width, height } = getFormat(next);
              setSize({ width, height });
            }}
            className="h-9 w-full rounded-md border bg-background px-2"
          >
            {IMAGE_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id === "custom"
                  ? f.label
                  : `${f.label} (${f.width} × ${f.height})`}
              </option>
            ))}
          </select>
        </div>
        {formatId === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              aria-label="Width"
              min={1}
              value={size.width}
              onChange={(e) =>
                setSize((s) => ({ ...s, width: e.currentTarget.valueAsNumber }))
              }
            />
            ×
            <Input
              type="number"
              aria-label="Height"
              min={1}
              value={size.height}
              onChange={(e) =>
                setSize((s) => ({
                  ...s,
                  height: e.currentTarget.valueAsNumber,
                }))
              }
            />
          </div>
        )}
        <Button
          size="sm"
          className="w-full"
          disabled={creating}
          onClick={create}
        >
          {creating ? <IsLoading label="Creating" /> : "Create"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
