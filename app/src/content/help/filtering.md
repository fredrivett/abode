# Filtering Your Items

You can search your <Abode /> in two ways:

- **Natural language** — Just type what you're looking for (e.g., "beach sunset photos"), we'll do our best to find what you're looking for
- **Filters** — Use `@` syntax for precise control (e.g., `@tag:landscape @source:instagram`)

Type `@` in the search box to see available filters.

## Filter Syntax

Filters use the format `@type:value`. For example:

- `@tag:landscape` — items tagged "landscape"
- `@source:instagram` — items from Instagram
- `@date:2024-01-15` — items from a specific date

## Filter Types

The "Stacks" column indicates whether you can add multiple filters of the same type. When stacking is allowed, each filter creates an [AND condition](#and-multiple-filters). All filter types support [OR via pipes](#or-pipe-syntax) (`|`).

<FilterTypesTable />

## Combining Filters

### AND (Multiple Filters)

Add multiple filters to require all conditions. Each filter chip represents an AND condition.

**Example:** `@tag:nature` + `@tag:sunset` finds items that have _both_ the "nature" AND "sunset" tags.

### OR (Pipe Syntax)

Use the pipe character `|` within a single filter value to match any of the options.

**Example:** `@source:instagram|camera-roll` finds items from Instagram OR Camera Roll.

This is especially useful for single-value fields like Type, Source, and Date where you can only have one filter at a time.

## Date Filters

Date filters support special operators:

- `@date:2024-01-15` — exact date
- `@date:>2024-01-15` — after this date
- `@date:<2024-01-15` — before this date
- `@date:2024-01-01..2024-01-31` — date range

## Negating Filters

Prefix a filter with `-` to exclude items matching that filter.

**Example:** `-@tag:private` excludes items tagged "private".

## Tips

- Type `@` and start typing to filter the list of available filter types
- Use keyboard navigation: Arrow keys to select, Enter or Tab to confirm
- Press Backspace on an empty search to remove the last filter chip
- Single-value filters (Type, Source, Date) will replace existing filters of the same type
