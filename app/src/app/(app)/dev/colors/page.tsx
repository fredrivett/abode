"use client";

import { getNearestColorName, NAMED_COLORS } from "@/lib/search/color-utils";

// Sample colors to test - a variety of hex values to see what they map to
const TEST_COLORS = [
  // Pure primaries
  "#FF0000",
  "#00FF00",
  "#0000FF",
  // Near primaries
  "#FF3030",
  "#CC0000",
  "#990000",
  "#30FF30",
  "#00CC00",
  "#009900",
  "#3030FF",
  "#0000CC",
  "#000099",
  // Oranges
  "#FFA500",
  "#FF8C00",
  "#FF6600",
  "#FF4500",
  // Pinks/Magentas
  "#FFC0CB",
  "#FF69B4",
  "#FF1493",
  "#FF00FF",
  // Purples
  "#800080",
  "#9400D3",
  "#8B008B",
  "#4B0082",
  // Browns
  "#A52A2A",
  "#8B4513",
  "#D2691E",
  "#CD853F",
  // Grays
  "#808080",
  "#A0A0A0",
  "#606060",
  "#C0C0C0",
  // Teals/Cyans
  "#008080",
  "#00FFFF",
  "#40E0D0",
  "#20B2AA",
  // Yellows/Golds
  "#FFFF00",
  "#FFD700",
  "#FFA500",
  "#FFEC8B",
  // Misc
  "#F5F5DC",
  "#E6E6FA",
  "#98FF98",
  "#FFDAB9",
  "#FA8072",
  "#FF7F50",
  "#EE82EE",
  "#F0E68C",
];

// Random/unusual colors that aren't close to named colors
const RANDOM_COLORS = [
  // Muted/desaturated
  "#7B6D8D", // Dusty purple
  "#8E9B7F", // Sage
  "#A39171", // Taupe
  "#6B7B8C", // Steel blue
  "#9C8B7D", // Warm gray
  // Unusual mixes
  "#2F4F4F", // Dark slate
  "#556B2F", // Dark olive
  "#8B7355", // Burlwood
  "#BC8F8F", // Rosy brown
  "#B0C4DE", // Light steel blue
  // Neon/vibrant
  "#39FF14", // Neon green
  "#FF073A", // Neon red
  "#7DF9FF", // Electric blue
  "#DFFF00", // Chartreuse
  "#FF6EC7", // Neon pink
  // Earth tones
  "#704214", // Sepia
  "#5C4033", // Dark brown
  "#C19A6B", // Camel
  "#E5AA70", // Fawn
  "#F4A460", // Sandy brown
  // Pastels
  "#FFB3BA", // Light pink
  "#FFDFBA", // Light peach
  "#FFFFBA", // Light yellow
  "#BAFFC9", // Light green
  "#BAE1FF", // Light blue
  // Dark/deep
  "#1A1A2E", // Dark navy
  "#16213E", // Midnight blue
  "#0F3460", // Deep blue
  "#533483", // Deep purple
  "#4A0E0E", // Deep red
  // Completely random hex values
  "#3D5A80",
  "#98C1D9",
  "#E0FBFC",
  "#EE6C4D",
  "#293241",
  "#F7B267",
  "#F79D65",
  "#F4845F",
  "#F27059",
  "#F25C54",
];

export default function ColorsDevPage() {
  return (
    <div className="flex-1 bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Color Mapping Reference</h1>
        <p className="text-gray-600 mb-8">
          This page shows how hex colors map to named colors using the
          getNearestColorName function (CIE76 deltaE).
        </p>

        {/* Named Colors Reference */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">
            Canonical Named Colors ({Object.keys(NAMED_COLORS).length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(NAMED_COLORS)
              .filter(([name]) => name !== "grey")
              .map(([name, hex]) => (
                <div
                  key={name}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  <div
                    className="h-16 w-full"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="p-2 text-center">
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-gray-500">{hex}</div>
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* Test Colors */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">
            Standard Test Colors ({TEST_COLORS.length})
          </h2>
          <p className="text-gray-600 mb-4">
            Colors that are close to the named color palette.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {TEST_COLORS.map((hex) => {
              const mappedName = getNearestColorName(hex);
              const mappedHex = mappedName
                ? NAMED_COLORS[mappedName]
                : "#000000";
              return (
                <div
                  key={hex}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  <div className="flex h-20">
                    <div
                      className="w-1/2 flex items-center justify-center text-xs font-mono"
                      style={{
                        backgroundColor: hex,
                        color: isLightColor(hex) ? "#000" : "#fff",
                      }}
                    >
                      {hex}
                    </div>
                    <div
                      className="w-1/2 flex items-center justify-center text-xs font-mono"
                      style={{
                        backgroundColor: mappedHex,
                        color: isLightColor(mappedHex) ? "#000" : "#fff",
                      }}
                    >
                      {mappedName}
                    </div>
                  </div>
                  <div className="p-2 text-center border-t">
                    <div className="text-sm">
                      <span className="font-mono">{hex}</span>
                      <span className="mx-2">→</span>
                      <span className="font-medium">{mappedName || "?"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Random/Unusual Colors */}
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Random/Unusual Colors ({RANDOM_COLORS.length})
          </h2>
          <p className="text-gray-600 mb-4">
            Muted, desaturated, and unusual colors that don&apos;t closely match
            named colors. These test how well the algorithm handles edge cases.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {RANDOM_COLORS.map((hex) => {
              const mappedName = getNearestColorName(hex);
              const mappedHex = mappedName
                ? NAMED_COLORS[mappedName]
                : "#000000";
              return (
                <div
                  key={hex}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  <div className="flex h-20">
                    <div
                      className="w-1/2 flex items-center justify-center text-xs font-mono"
                      style={{
                        backgroundColor: hex,
                        color: isLightColor(hex) ? "#000" : "#fff",
                      }}
                    >
                      {hex}
                    </div>
                    <div
                      className="w-1/2 flex items-center justify-center text-xs font-mono"
                      style={{
                        backgroundColor: mappedHex,
                        color: isLightColor(mappedHex) ? "#000" : "#fff",
                      }}
                    >
                      {mappedName}
                    </div>
                  </div>
                  <div className="p-2 text-center border-t">
                    <div className="text-sm">
                      <span className="font-mono">{hex}</span>
                      <span className="mx-2">→</span>
                      <span className="font-medium">{mappedName || "?"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// Helper to determine if a color is light (for text contrast)
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
