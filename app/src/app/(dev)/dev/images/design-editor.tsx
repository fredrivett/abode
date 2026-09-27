"use client";

import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { GALLERY_CARDS } from "@/app/(marketing)/_components/gallery-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  createDesign,
  deleteDesign,
  exportDesignImage,
  saveDesign,
} from "./actions";
import { Artboard, ScaledPreview, useDesignTheme } from "./artboard";
import { NumberSlider, Section, Toggle } from "./controls";
import {
  type CardConfig,
  type Design,
  defaultCardConfig,
  defaultDesign,
} from "./design";
import { getFormat } from "./formats";

const SAVE_DEBOUNCE_MS = 400;
// How long the delete button waits for a confirming second click
const DELETE_CONFIRM_MS = 3000;

type SaveStatus = "saved" | "saving" | "error";
type PixelRatio = 1 | 2;

type NumericKey<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

/** Edits one saved design, autosaving it to its JSON file */
export function DesignEditor({
  slug,
  initial,
  toolbar,
}: {
  slug: string;
  initial: Design;
  toolbar: ReactNode;
}) {
  const router = useRouter();
  const [design, setDesign] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [exporting, setExporting] = useState<PixelRatio | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  // Last design known to be on disk, and the latest edit (flushed on unmount)
  const persistedRef = useRef(JSON.stringify(initial));
  const latestRef = useRef(initial);
  const deletedRef = useRef(false);

  useDesignTheme(design.theme);

  useEffect(() => {
    latestRef.current = design;
    const json = JSON.stringify(design);
    if (json === persistedRef.current) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      const result = await saveDesign(slug, design).catch(() => ({
        success: false,
      }));
      if (result.success) persistedRef.current = json;
      setSaveStatus(result.success ? "saved" : "error");
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [design, slug]);

  // Switching designs mid-debounce would otherwise drop the last edit
  useEffect(
    () => () => {
      const latest = latestRef.current;
      if (deletedRef.current) return;
      if (JSON.stringify(latest) !== persistedRef.current) {
        void saveDesign(slug, latest);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(
      () => setConfirmingDelete(false),
      DELETE_CONFIRM_MS,
    );
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const update = useCallback((patch: Partial<Design>) => {
    setDesign((d) => ({ ...d, ...patch }));
  }, []);

  const updateCard = useCallback((id: string, patch: Partial<CardConfig>) => {
    setDesign((d) => ({
      ...d,
      cards: d.cards.map((card) =>
        card.id === id ? { ...card, ...patch } : card,
      ),
    }));
  }, []);

  const selected = design.cards.find((c) => c.id === selectedId) ?? null;
  const selectedCard = GALLERY_CARDS.find((c) => c.id === selectedId);
  const format = getFormat(design.format);

  const saveImage = async (pixelRatio: PixelRatio) => {
    setExporting(pixelRatio);
    const result = await exportDesignImage(slug, design, pixelRatio).catch(
      (error: unknown) => ({
        png: undefined,
        error: error instanceof Error ? error.message : "Export failed",
      }),
    );
    setExporting(null);
    if (!result.png) {
      toast.error(`Couldn't save image: ${result.error ?? "unknown error"}`);
      return;
    }
    const suffix = pixelRatio === 2 ? "@2x" : "";
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${result.png}`;
    link.download = `abode-${slug}-${design.theme}${suffix}.png`;
    link.click();
  };

  const duplicate = async () => {
    const result = await createDesign({
      ...design,
      name: `${design.name} copy`,
    });
    if (result.slug) router.push(`?design=${result.slug}`);
    else toast.error(`Couldn't duplicate: ${result.error ?? "unknown error"}`);
  };

  const remove = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deletedRef.current = true;
    const result = await deleteDesign(slug);
    if (result.success) {
      router.push("?");
      return;
    }
    deletedRef.current = false;
    toast.error(`Couldn't delete: ${result.error ?? "unknown error"}`);
  };

  const copySettings = async () => {
    await navigator.clipboard.writeText(JSON.stringify(design, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-muted/30 p-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-3 lg:sticky lg:top-4">
        {toolbar}
        <ScaledPreview width={design.width} height={design.height}>
          {(scale) => (
            <Artboard
              design={design}
              scale={scale}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={(id, x, y) => updateCard(id, { x, y })}
            />
          )}
        </ScaledPreview>
        <div className="flex flex-wrap items-center gap-2">
          {([1, 2] as const).map((ratio) => (
            <Button
              key={ratio}
              size="sm"
              variant={ratio === 1 ? "default" : "outline"}
              disabled={exporting !== null}
              onClick={() => saveImage(ratio)}
            >
              {exporting === ratio ? (
                <IsLoading label="Rendering" />
              ) : ratio === 1 ? (
                "Save as image"
              ) : (
                "Save @2x"
              )}
            </Button>
          ))}
          <p className="text-muted-foreground text-sm">
            Click a card to select it, drag to move, arrow keys to nudge (shift
            = 10px).
          </p>
        </div>
      </div>

      <aside className="w-full shrink-0 space-y-5 rounded-xl border bg-background p-4 text-sm lg:max-h-[calc(100vh-2rem)] lg:w-80 lg:overflow-y-auto">
        <Section title="Image">
          <Input
            key={design.name}
            defaultValue={design.name}
            aria-label="Name"
            onBlur={(e) => {
              const name = e.currentTarget.value.trim();
              if (name) update({ name });
              else e.currentTarget.value = design.name;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <p className="text-muted-foreground">
            {format.label} · {design.width} × {design.height}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={duplicate}>
              Duplicate
            </Button>
            <Button
              size="sm"
              variant={confirmingDelete ? "destructive" : "outline"}
              onClick={remove}
            >
              {confirmingDelete ? "Click again to delete" : "Delete"}
            </Button>
          </div>
        </Section>

        <Section title="Canvas">
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((theme) => (
              <Button
                key={theme}
                size="sm"
                variant={design.theme === theme ? "default" : "outline"}
                onClick={() => update({ theme })}
              >
                {theme}
              </Button>
            ))}
          </div>
          {format.guide && (
            <Toggle
              label={`${format.guide.label} guide`}
              checked={design.showGuide}
              onChange={(showGuide) => update({ showGuide })}
            />
          )}
          <Toggle
            label="Book tile background"
            checked={design.bookTile}
            onChange={(bookTile) => update({ bookTile })}
          />
          <DesignSlider
            design={design}
            update={update}
            field="cardWidth"
            label="Card base width"
            min={100}
            max={Math.max(500, Math.round(design.width / 2))}
          />
        </Section>

        <Section title="Text">
          <DesignSlider
            design={design}
            update={update}
            field="headlineSize"
            label="Headline size"
            min={24}
            max={200}
          />
          <DesignSlider
            design={design}
            update={update}
            field="textWidth"
            label="Text width"
            min={200}
            max={design.width}
          />
          <Toggle
            label="Highlight “yours.”"
            checked={design.highlight}
            onChange={(highlight) => update({ highlight })}
          />
          <Toggle
            label="Tagline"
            checked={design.showTagline}
            onChange={(showTagline) => update({ showTagline })}
          />
          {design.showTagline && (
            <>
              <DesignSlider
                design={design}
                update={update}
                field="taglineSize"
                label="Tagline size"
                min={12}
                max={80}
              />
              <DesignSlider
                design={design}
                update={update}
                field="taglineGap"
                label="Tagline gap"
                min={0}
                max={120}
              />
            </>
          )}
          <DesignSlider
            design={design}
            update={update}
            field="textX"
            label="Offset x"
            min={-Math.round(design.width / 2)}
            max={Math.round(design.width / 2)}
          />
          <DesignSlider
            design={design}
            update={update}
            field="textY"
            label="Offset y"
            min={-Math.round(design.height / 2)}
            max={Math.round(design.height / 2)}
          />
        </Section>

        {selected && selectedCard && (
          <Section title={selected.id}>
            <CardSlider
              card={selected}
              updateCard={updateCard}
              field="x"
              min={-400}
              max={design.width}
            />
            <CardSlider
              card={selected}
              updateCard={updateCard}
              field="y"
              min={-400}
              max={design.height}
            />
            <CardSlider
              card={selected}
              updateCard={updateCard}
              field="scale"
              min={0.2}
              max={1.5}
              step={0.01}
            />
            <CardSlider
              card={selected}
              updateCard={updateCard}
              field="rot"
              label="rotation"
              min={-30}
              max={30}
              step={0.5}
            />
            <CardSlider
              card={selected}
              updateCard={updateCard}
              field="blur"
              min={0}
              max={12}
              step={0.5}
            />
            <CardSlider
              card={selected}
              updateCard={updateCard}
              field="fade"
              min={0}
              max={0.9}
              step={0.01}
            />
            <CardSlider
              card={selected}
              updateCard={updateCard}
              field="z"
              label="depth (z)"
              min={0}
              max={60}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateCard(selected.id, defaultCardConfig(selectedCard, design))
              }
            >
              Reset card
            </Button>
          </Section>
        )}

        <Section title="Cards">
          <ul className="space-y-1">
            {design.cards.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Switch
                  checked={c.visible}
                  onCheckedChange={(visible) => updateCard(c.id, { visible })}
                  aria-label={`Show ${c.id}`}
                />
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex-1 truncate rounded px-2 py-1 text-left hover:bg-muted",
                    c.id === selectedId && "bg-muted font-medium",
                    !c.visible && "text-muted-foreground line-through",
                  )}
                >
                  {c.id}
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <p className="border-t pt-4 text-muted-foreground text-xs">
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && `Saved to designs/${slug}.json`}
          {saveStatus === "error" && (
            <span className="text-destructive">
              Couldn&rsquo;t save — check the dev server log
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copySettings}>
            {copied ? "Copied" : "Copy settings"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDesign(defaultDesign(design));
              setSelectedId(null);
            }}
          >
            Reset layout
          </Button>
        </div>
      </aside>
    </div>
  );
}

function DesignSlider({
  design,
  update,
  field,
  label,
  min,
  max,
}: {
  design: Design;
  update: (patch: Partial<Design>) => void;
  field: NumericKey<Design>;
  label: string;
  min: number;
  max: number;
}) {
  return (
    <NumberSlider
      label={label}
      value={design[field]}
      min={min}
      max={max}
      onChange={(value) => update({ [field]: value })}
    />
  );
}

function CardSlider({
  card,
  updateCard,
  field,
  label,
  min,
  max,
  step,
}: {
  card: CardConfig;
  updateCard: (id: string, patch: Partial<CardConfig>) => void;
  field: NumericKey<CardConfig>;
  label?: string;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <NumberSlider
      label={label ?? field}
      value={card[field]}
      min={min}
      max={max}
      step={step}
      onChange={(value) => updateCard(card.id, { [field]: value })}
    />
  );
}
