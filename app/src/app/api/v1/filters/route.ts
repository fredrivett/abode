import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/filters");

type FilterType = "tag" | "object" | "color" | "source" | "location" | "type";

type FiltersResponse = {
  tag?: string[];
  object?: string[];
  color?: string[];
  source?: string[];
  location?: string[];
  type?: string[];
};

/**
 * GET /api/v1/filters
 *
 * Returns available filter values for autocomplete.
 * - If `type` query param provided: returns values for that filter type only
 * - If no `type`: returns all filter values grouped by type
 * - All values sorted alphabetically
 * - Location values deduplicated across all location fields
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(user.id, "filters");
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult, "filters"),
        },
      );
    }

    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get("type") as FilterType | null;

    const response: FiltersResponse = {};

    // Helper to fetch and sort unique values
    const fetchTags = async (): Promise<string[]> => {
      // Fetch both auto-generated tags and user tags, combine and deduplicate
      const result = await db.$queryRaw<{ tag: string }[]>`
        SELECT DISTINCT tag
        FROM (
          SELECT unnest(tags) as tag
          FROM items
          WHERE user_id = ${user.id}::uuid
          UNION
          SELECT unnest(user_tags) as tag
          FROM items
          WHERE user_id = ${user.id}::uuid
        ) all_tags
        ORDER BY tag
      `;
      return result.map((r) => r.tag);
    };

    const fetchObjects = async (): Promise<string[]> => {
      const result = await db.$queryRaw<{ object: string }[]>`
        SELECT DISTINCT unnest(iid.objects) as object
        FROM item_image_details iid
        JOIN items i ON i.id = iid.item_id
        WHERE i.user_id = ${user.id}::uuid
        ORDER BY object
      `;
      return result.map((r) => r.object);
    };

    const fetchColors = async (): Promise<string[]> => {
      // Colors are stored as JSON array of {hex, name, score} objects
      // Return distinct color names for filtering
      // Use a subquery to extract color names since set-returning functions
      // can't be used directly in WHERE clauses
      const result = await db.$queryRaw<{ name: string }[]>`
        SELECT DISTINCT color_data.name
        FROM item_image_details iid
        JOIN items i ON i.id = iid.item_id
        CROSS JOIN LATERAL jsonb_array_elements(iid.colors) AS color_elem
        CROSS JOIN LATERAL (
          SELECT color_elem->>'name' AS name
        ) AS color_data
        WHERE i.user_id = ${user.id}::uuid
          AND iid.colors IS NOT NULL
          AND color_data.name IS NOT NULL
        ORDER BY color_data.name
      `;
      return result.map((r) => r.name);
    };

    const fetchSources = async (): Promise<string[]> => {
      const result = await db.$queryRaw<{ source_type: string }[]>`
        SELECT DISTINCT source_type
        FROM items
        WHERE user_id = ${user.id}::uuid
          AND source_type IS NOT NULL
        ORDER BY source_type
      `;
      return result.map((r) => r.source_type);
    };

    const fetchLocations = async (): Promise<string[]> => {
      // Get unique values from all location fields, deduplicated
      const result = await db.$queryRaw<{ location: string }[]>`
        SELECT DISTINCT location
        FROM (
          SELECT neighborhood as location FROM item_locations il
          JOIN items i ON i.id = il.item_id
          WHERE i.user_id = ${user.id}::uuid AND neighborhood IS NOT NULL
          UNION
          SELECT city as location FROM item_locations il
          JOIN items i ON i.id = il.item_id
          WHERE i.user_id = ${user.id}::uuid AND city IS NOT NULL
          UNION
          SELECT region as location FROM item_locations il
          JOIN items i ON i.id = il.item_id
          WHERE i.user_id = ${user.id}::uuid AND region IS NOT NULL
          UNION
          SELECT country as location FROM item_locations il
          JOIN items i ON i.id = il.item_id
          WHERE i.user_id = ${user.id}::uuid AND country IS NOT NULL
        ) locations
        ORDER BY location
      `;
      return result.map((r) => r.location);
    };

    const fetchTypes = async (): Promise<string[]> => {
      const result = await db.$queryRaw<{ kind: string }[]>`
        SELECT DISTINCT kind
        FROM items
        WHERE user_id = ${user.id}::uuid
          AND kind IS NOT NULL
        ORDER BY kind
      `;
      return result.map((r) => r.kind);
    };

    // If specific type requested, fetch only that
    if (filterType) {
      switch (filterType) {
        case "tag":
          response.tag = await fetchTags();
          break;
        case "object":
          response.object = await fetchObjects();
          break;
        case "color":
          response.color = await fetchColors();
          break;
        case "source":
          response.source = await fetchSources();
          break;
        case "location":
          response.location = await fetchLocations();
          break;
        case "type":
          response.type = await fetchTypes();
          break;
        default:
          return NextResponse.json(
            { message: "Invalid filter type" },
            { status: 400 },
          );
      }
    } else {
      // Fetch all filter values in parallel
      const [tags, objects, colors, sources, locations, types] =
        await Promise.all([
          fetchTags(),
          fetchObjects(),
          fetchColors(),
          fetchSources(),
          fetchLocations(),
          fetchTypes(),
        ]);

      response.tag = tags;
      response.object = objects;
      response.color = colors;
      response.source = sources;
      response.location = locations;
      response.type = types;
    }

    return NextResponse.json(response, {
      headers: getRateLimitHeaders(rateLimitResult, "filters"),
    });
  } catch (error) {
    log.error({ error }, "Filters fetch error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
