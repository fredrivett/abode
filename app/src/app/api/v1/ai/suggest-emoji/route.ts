import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createLogger } from "@/lib/logger.server";
import {
  checkRateLimit,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/ai/suggest-emoji");

// Matches a single emoji (including compound emojis like flags, skin tones, etc.)
const EMOJI_REGEX = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;

function isValidEmoji(str: string): boolean {
  return EMOJI_REGEX.test(str);
}

let openaiClient: OpenAI | null = null;
function getOpenAiClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * POST /api/v1/ai/suggest-emoji - Suggest an emoji for a room name
 * Rate limited: 30 req/min, 180 req/day
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check per-minute rate limit
    const minuteLimit = checkRateLimit(user.id, "emojiSuggest");
    if (!minuteLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        {
          status: 429,
          headers: getRateLimitHeaders(minuteLimit, "emojiSuggest"),
        },
      );
    }

    // Check daily rate limit
    const dailyLimit = checkRateLimit(user.id, "emojiSuggestDaily");
    if (!dailyLimit.allowed) {
      return NextResponse.json(
        { message: "Daily limit reached" },
        {
          status: 429,
          headers: getRateLimitHeaders(dailyLimit, "emojiSuggestDaily"),
        },
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Room name is required" },
        { status: 400 },
      );
    }

    const client = getOpenAiClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Suggest one emoji that best represents a room/collection named "${name.trim()}". Reply with only the emoji, nothing else.`,
        },
      ],
      max_tokens: 10,
      temperature: 0.7,
    });

    const rawResponse = response.choices[0]?.message?.content?.trim() ?? null;

    if (!rawResponse) {
      log.warn({ name }, "AI returned empty response");
      return NextResponse.json(
        { message: "No emoji suggested" },
        { status: 422 },
      );
    }

    if (!isValidEmoji(rawResponse)) {
      log.warn({ name, rawResponse }, "AI returned invalid emoji");
      return NextResponse.json(
        { message: "Invalid emoji response" },
        { status: 422 },
      );
    }

    return NextResponse.json({ emoji: rawResponse });
  } catch (error) {
    log.error({ error }, "Emoji suggestion error");
    return NextResponse.json(
      { message: "Failed to suggest emoji" },
      { status: 500 },
    );
  }
}
