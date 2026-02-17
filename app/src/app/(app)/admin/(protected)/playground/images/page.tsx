"use client";

import { ChevronDown, ChevronUp, ImageIcon, Loader2, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import type { AnalyzeImageResponse } from "@/app/api/admin/playground/analyze-image/route";
import { Button } from "@/components/ui/button";

function ColorSwatch({
  hex,
  name,
  score,
  paletteType,
}: {
  hex: string;
  name: string;
  score?: number;
  paletteType?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded border bg-white p-2">
      <div
        className="h-8 w-8 shrink-0 rounded border"
        style={{ backgroundColor: hex }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-sm">{name}</div>
        <div className="truncate font-mono text-muted-foreground text-xs">
          {hex}
          {paletteType && <span className="ml-1 opacity-60">({paletteType})</span>}
          {score !== undefined && (
            <span className="ml-1 opacity-60">({(score * 100).toFixed(1)}%)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TagList({ tags, label }: { tags: string[]; label: string }) {
  if (tags.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </h4>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Tags can be duplicated, stable order
          <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-sm">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function CollapsibleRaw({
  data,
  label,
}: {
  data: unknown;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 border-t pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left font-medium text-muted-foreground text-sm hover:text-foreground"
      >
        <span>{label}</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 font-mono text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function GoogleVisionResults({
  result,
}: {
  result: NonNullable<AnalyzeImageResponse["googleVisionPlusVibrant"]>;
}) {
  const { visionAnalysis, vibrantColors, aiTitle } = result;

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Title
        </h4>
        <div className="space-y-1">
          <p className="font-semibold text-lg">
            {aiTitle || visionAnalysis.title || "No title generated"}
          </p>
          {aiTitle && visionAnalysis.title && aiTitle !== visionAnalysis.title && (
            <p className="text-muted-foreground text-sm">
              Vision-derived: {visionAnalysis.title}
            </p>
          )}
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Description
        </h4>
        <p className="text-sm">{visionAnalysis.description || "No description"}</p>
      </div>

      {/* Tags & Objects */}
      <TagList tags={visionAnalysis.tags} label="Tags (from Vision API)" />
      <TagList tags={visionAnalysis.objects} label="Objects (from Vision API)" />

      {/* OCR Text */}
      {visionAnalysis.ocrText && (
        <div>
          <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            OCR Text
          </h4>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-sm">
            {visionAnalysis.ocrText}
          </pre>
        </div>
      )}

      {/* Colors from Vision API */}
      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Colors (from Vision API)
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visionAnalysis.colors.map((color, i) => (
            <ColorSwatch
              key={`vision-${color.hex}-${i}`}
              hex={color.hex}
              name={color.name}
              score={color.score}
            />
          ))}
        </div>
      </div>

      {/* Colors from Vibrant */}
      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Colors (from node-vibrant)
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {vibrantColors.colors.map((color, i) => (
            <ColorSwatch
              key={`vibrant-${color.hex}-${i}`}
              hex={color.hex}
              name={color.name}
              paletteType={color.paletteType}
            />
          ))}
        </div>
      </div>

      <CollapsibleRaw
        data={{ visionAnalysis, vibrantColors, aiTitle }}
        label="View Raw Response"
      />
    </div>
  );
}

function OpenAIVisionResults({
  result,
}: {
  result: NonNullable<AnalyzeImageResponse["openaiVision"]>;
}) {
  const { analysis, usage, model } = result;

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Title
        </h4>
        <p className="font-semibold text-lg">{analysis.title}</p>
      </div>

      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Description
        </h4>
        <p className="text-sm">{analysis.description}</p>
      </div>

      {/* Tags & Objects */}
      <TagList tags={analysis.tags} label="Tags" />
      <TagList tags={analysis.objects} label="Objects" />

      {/* OCR Text */}
      {analysis.ocrText && (
        <div>
          <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            OCR Text
          </h4>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-sm">
            {analysis.ocrText}
          </pre>
        </div>
      )}

      {/* Colors */}
      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Colors
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.dominantColors.map((color, i) => (
            <ColorSwatch
              key={`openai-${color.hex}-${i}`}
              hex={color.hex}
              name={color.name}
            />
          ))}
        </div>
      </div>

      {/* Usage & Cost */}
      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          API Usage
        </h4>
        <div className="rounded bg-muted p-3 font-mono text-xs">
          <p>Model: {model}</p>
          <p>Prompt tokens: {usage.promptTokens.toLocaleString()}</p>
          <p>Completion tokens: {usage.completionTokens.toLocaleString()}</p>
          <p>Total tokens: {usage.totalTokens.toLocaleString()}</p>
          <p className="mt-1 text-muted-foreground">
            Est. cost: $
            {(
              (usage.promptTokens * 0.00000015 + usage.completionTokens * 0.0000006)
            ).toFixed(6)}
          </p>
        </div>
      </div>

      <CollapsibleRaw data={result} label="View Raw Response" />
    </div>
  );
}

export default function ImagePlaygroundPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setError(null);
      }
    },
    [],
  );

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const analyzeImage = useCallback(async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("methods", "google-vision,openai-vision");

      const response = await fetch("/api/admin/playground/analyze-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      const data: AnalyzeImageResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <header className="mb-8">
          <h1 className="font-semibold text-2xl tracking-tight">
            Image Analysis Playground
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Compare Google Vision + node-vibrant vs OpenAI Vision for image analysis
          </p>
        </header>

        {/* Upload Area */}
        <div className="mb-8">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Drop zone with file input */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="relative flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed bg-muted/50 p-8 transition-colors hover:border-muted-foreground/50 hover:bg-muted"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {previewUrl ? (
              <div className="flex flex-col items-center gap-4">
                {/* biome-ignore lint/performance/noImgElement: Using blob URL for preview */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-64 max-w-full rounded-lg object-contain shadow-lg"
                />
                <p className="text-muted-foreground text-sm">
                  {selectedFile?.name} ({((selectedFile?.size ?? 0) / 1024).toFixed(1)} KB)
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="rounded-full bg-muted p-3">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium">Drop an image here or click to upload</p>
                <p className="text-muted-foreground text-sm">
                  Supports JPG, PNG, WebP, GIF
                </p>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="mt-4 flex justify-center">
              <Button
                onClick={analyzeImage}
                disabled={isAnalyzing}
                size="lg"
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Analyze Image
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Timing */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-2 font-medium">Timing</h3>
              <div className="flex flex-wrap gap-4 font-mono text-sm">
                {result.timing.googleVisionMs !== undefined && (
                  <span>Vision API: {result.timing.googleVisionMs}ms</span>
                )}
                {result.timing.vibrantMs !== undefined && (
                  <span>Vibrant: {result.timing.vibrantMs}ms</span>
                )}
                {result.timing.aiTitleMs !== undefined && (
                  <span>AI Title: {result.timing.aiTitleMs}ms</span>
                )}
                {result.timing.openaiVisionMs !== undefined && (
                  <span>OpenAI Vision: {result.timing.openaiVisionMs}ms</span>
                )}
                <span className="font-semibold">Total: {result.timing.totalMs}ms</span>
              </div>
            </div>

            {/* Side by side comparison */}
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Google Vision + Vibrant */}
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-lg">
                    Google Vision + node-vibrant
                  </h2>
                  {result.errors.googleVision && (
                    <span className="rounded bg-red-100 px-2 py-1 text-red-700 text-xs">
                      Error
                    </span>
                  )}
                </div>
                {result.errors.googleVision ? (
                  <p className="text-red-600 text-sm">{result.errors.googleVision}</p>
                ) : result.googleVisionPlusVibrant ? (
                  <GoogleVisionResults result={result.googleVisionPlusVibrant} />
                ) : (
                  <p className="text-muted-foreground">No results</p>
                )}
              </div>

              {/* OpenAI Vision */}
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-lg">OpenAI Vision (GPT-4o-mini)</h2>
                  {result.errors.openaiVision && (
                    <span className="rounded bg-red-100 px-2 py-1 text-red-700 text-xs">
                      Error
                    </span>
                  )}
                </div>
                {result.errors.openaiVision ? (
                  <p className="text-red-600 text-sm">{result.errors.openaiVision}</p>
                ) : result.openaiVision ? (
                  <OpenAIVisionResults result={result.openaiVision} />
                ) : (
                  <p className="text-muted-foreground">No results</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
