import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/admin/auth";
import {
  analyzeImageWithOpenAI,
  type OpenAIVisionAnalysisResult,
} from "@/lib/image-analysis/openai-vision";
import {
  extractColorsWithVibrant,
  type VibrantResult,
} from "@/lib/image-analysis/vibrant";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeImage,
  generateAITitle,
  type ImageAnalysisResult,
} from "@/lib/vision";

export type AnalysisMethod = "google-vision" | "openai-vision";

export type GoogleVisionPlusVibrantResult = {
  visionAnalysis: ImageAnalysisResult;
  vibrantColors: VibrantResult;
  aiTitle: string | null;
};

export type AnalyzeImageResponse = {
  googleVisionPlusVibrant: GoogleVisionPlusVibrantResult | null;
  openaiVision: OpenAIVisionAnalysisResult | null;
  errors: {
    googleVision?: string;
    openaiVision?: string;
  };
  timing: {
    googleVisionMs?: number;
    vibrantMs?: number;
    aiTitleMs?: number;
    openaiVisionMs?: number;
    totalMs: number;
  };
};

export async function POST(request: Request) {
  const startTime = Date.now();

  // Check admin access
  const supabase = await createClient();
  const access = await checkAdminAccess(supabase);

  if (!access.isAdmin || !access.isAAL2) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const methods = (formData.get("methods") as string)?.split(",") ?? [
      "google-vision",
      "openai-vision",
    ];

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "image/jpeg";
    const originalFilename = file.name;

    const response: AnalyzeImageResponse = {
      googleVisionPlusVibrant: null,
      openaiVision: null,
      errors: {},
      timing: {
        totalMs: 0,
      },
    };

    // Run analyses in parallel
    const promises: Promise<void>[] = [];

    // Google Vision + Vibrant + AI Title
    if (methods.includes("google-vision")) {
      promises.push(
        (async () => {
          try {
            // Google Vision API
            const visionStart = Date.now();
            const visionAnalysis = await analyzeImage(buffer);
            response.timing.googleVisionMs = Date.now() - visionStart;

            // Vibrant colors
            const vibrantStart = Date.now();
            const vibrantColors = await extractColorsWithVibrant(buffer);
            response.timing.vibrantMs = Date.now() - vibrantStart;

            // AI Title generation
            const aiTitleStart = Date.now();
            const aiTitle = await generateAITitle({
              originalFilename,
              labels: visionAnalysis.tags,
              objects: visionAnalysis.objects,
              ocrText: visionAnalysis.ocrText,
            });
            response.timing.aiTitleMs = Date.now() - aiTitleStart;

            response.googleVisionPlusVibrant = {
              visionAnalysis,
              vibrantColors,
              aiTitle,
            };
          } catch (error) {
            response.errors.googleVision =
              error instanceof Error ? error.message : "Unknown error";
          }
        })(),
      );
    }

    // OpenAI Vision
    if (methods.includes("openai-vision")) {
      promises.push(
        (async () => {
          try {
            const openaiStart = Date.now();
            const result = await analyzeImageWithOpenAI(buffer, mimeType);
            response.timing.openaiVisionMs = Date.now() - openaiStart;
            response.openaiVision = result;
          } catch (error) {
            response.errors.openaiVision =
              error instanceof Error ? error.message : "Unknown error";
          }
        })(),
      );
    }

    await Promise.all(promises);

    response.timing.totalMs = Date.now() - startTime;

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
