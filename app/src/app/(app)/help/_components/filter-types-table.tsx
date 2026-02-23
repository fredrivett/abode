"use client";

import { FILTER_TYPES, type FilterType } from "@/lib/search/types";

const filterTypeDescriptions: Record<FilterType, string> = {
  type: "The kind of item (image, video, etc.)",
  tag: "Labels you've added to items",
  object: "Detected objects in images",
  color: "Dominant colors in images",
  source: "Where the item came from",
  date: "When the item was created",
  location: "Where the item was taken",
};

/**
 * Table showing all available filter types with their labels, descriptions, and AND/OR support.
 */
export function FilterTypesTable() {
  const filterTypes = Object.entries(FILTER_TYPES) as [
    FilterType,
    (typeof FILTER_TYPES)[FilterType],
  ][];

  return (
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Description</th>
          <th>
            <a href="#and-multiple-filters">Stacks (AND)</a>
          </th>
          <th>
            <a href="#or-pipe-syntax">Pipes (OR)</a>
          </th>
        </tr>
      </thead>
      <tbody>
        {filterTypes.map(([type, meta]) => (
          <tr key={type}>
            <td>
              {meta.icon} <strong>{meta.label}</strong>
            </td>
            <td>{filterTypeDescriptions[type]}</td>
            <td>{meta.multiple ? "✅" : "❌"}</td>
            <td>✅</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
