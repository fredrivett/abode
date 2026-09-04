import db from "@/lib/db";
import { VALID_READ_STATES } from "@/lib/search/query-builder";

export type AvailableFilterType =
  | "tag"
  | "object"
  | "color"
  | "source"
  | "location"
  | "type"
  | "read";

export type AvailableFilters = {
  tag?: string[];
  object?: string[];
  color?: string[];
  source?: string[];
  location?: string[];
  type?: string[];
  read?: string[];
};

// Auto-generated tags + manual user tags, combined and deduplicated
async function fetchTags(userId: string): Promise<string[]> {
  const result = await db.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT tag
    FROM (
      SELECT unnest(tags) as tag
      FROM items
      WHERE user_id = ${userId}::uuid
      UNION
      SELECT unnest(user_tags) as tag
      FROM items
      WHERE user_id = ${userId}::uuid
    ) all_tags
    ORDER BY tag
  `;
  return result.map((r) => r.tag);
}

async function fetchObjects(userId: string): Promise<string[]> {
  const result = await db.$queryRaw<{ object: string }[]>`
    SELECT DISTINCT unnest(iid.objects) as object
    FROM item_image_details iid
    JOIN items i ON i.id = iid.item_id
    WHERE i.user_id = ${userId}::uuid
    ORDER BY object
  `;
  return result.map((r) => r.object);
}

// Colors are stored as a JSON array of {hex, name, score}; return distinct names
async function fetchColors(userId: string): Promise<string[]> {
  const result = await db.$queryRaw<{ name: string }[]>`
    SELECT DISTINCT color_data.name
    FROM item_image_details iid
    JOIN items i ON i.id = iid.item_id
    CROSS JOIN LATERAL jsonb_array_elements(iid.colors) AS color_elem
    CROSS JOIN LATERAL (
      SELECT color_elem->>'name' AS name
    ) AS color_data
    WHERE i.user_id = ${userId}::uuid
      AND iid.colors IS NOT NULL
      AND color_data.name IS NOT NULL
    ORDER BY color_data.name
  `;
  return result.map((r) => r.name);
}

async function fetchSources(userId: string): Promise<string[]> {
  const result = await db.$queryRaw<{ source_type: string }[]>`
    SELECT DISTINCT source_type
    FROM items
    WHERE user_id = ${userId}::uuid
      AND source_type IS NOT NULL
    ORDER BY source_type
  `;
  return result.map((r) => r.source_type);
}

// Unique values across all location fields, deduplicated
async function fetchLocations(userId: string): Promise<string[]> {
  const result = await db.$queryRaw<{ location: string }[]>`
    SELECT DISTINCT location
    FROM (
      SELECT neighborhood as location FROM item_locations il
      JOIN items i ON i.id = il.item_id
      WHERE i.user_id = ${userId}::uuid AND neighborhood IS NOT NULL
      UNION
      SELECT city as location FROM item_locations il
      JOIN items i ON i.id = il.item_id
      WHERE i.user_id = ${userId}::uuid AND city IS NOT NULL
      UNION
      SELECT region as location FROM item_locations il
      JOIN items i ON i.id = il.item_id
      WHERE i.user_id = ${userId}::uuid AND region IS NOT NULL
      UNION
      SELECT country as location FROM item_locations il
      JOIN items i ON i.id = il.item_id
      WHERE i.user_id = ${userId}::uuid AND country IS NOT NULL
    ) locations
    ORDER BY location
  `;
  return result.map((r) => r.location);
}

async function fetchTypes(userId: string): Promise<string[]> {
  const result = await db.$queryRaw<{ kind: string }[]>`
    SELECT DISTINCT kind
    FROM items
    WHERE user_id = ${userId}::uuid
      AND kind IS NOT NULL
    ORDER BY kind
  `;
  return result.map((r) => r.kind);
}

// Read states are a fixed vocabulary (not user-derived), so the full ordered
// list is always offered for autocomplete.
async function fetchReadStates(): Promise<string[]> {
  return [...VALID_READ_STATES];
}

const FETCHERS: Record<
  AvailableFilterType,
  (userId: string) => Promise<string[]>
> = {
  tag: fetchTags,
  object: fetchObjects,
  color: fetchColors,
  source: fetchSources,
  location: fetchLocations,
  type: fetchTypes,
  read: fetchReadStates,
};

/**
 * A user's distinct filterable values for autocomplete and discovery. With a
 * `type`, returns just that group; otherwise all six run in parallel. All values
 * are sorted alphabetically and scoped to the user. Shared by the filters API
 * and the MCP server.
 */
export async function getAvailableFilters(
  userId: string,
  type?: AvailableFilterType,
): Promise<AvailableFilters> {
  if (type !== undefined) {
    return { [type]: await FETCHERS[type](userId) };
  }

  const [tag, object, color, source, location, typeValues, read] =
    await Promise.all([
      fetchTags(userId),
      fetchObjects(userId),
      fetchColors(userId),
      fetchSources(userId),
      fetchLocations(userId),
      fetchTypes(userId),
      fetchReadStates(),
    ]);

  return { tag, object, color, source, location, type: typeValues, read };
}
