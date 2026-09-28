import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { MasonryGrid } from "./masonry-grid";

type Card = { id: string; width: number; height: number; fresh?: boolean };

// Deterministic mix of shapes (portrait, square, landscape, tall)
const SHAPES: Array<[number, number]> = [
  [3, 4],
  [1, 1],
  [4, 3],
  [9, 16],
  [16, 9],
  [1, 1],
  [3, 4],
  [2, 3],
];
const HUES = [18, 172, 204, 44, 28, 96, 280, 340];

function makeCards(count: number, start = 0): Card[] {
  return Array.from({ length: count }, (_, index) => {
    const n = start + index;
    const [width, height] = SHAPES[n % SHAPES.length];
    return { id: `card-${n}`, width, height };
  });
}

function CardFace({ card }: { card: Card }) {
  const hue = HUES[Number(card.id.split("-")[1]) % HUES.length];
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-lg font-mono text-sm text-white"
      style={{ background: `hsl(${hue} 55% 45%)` }}
    >
      {card.id}
    </div>
  );
}

function Grid({ cards, animate = true }: { cards: Card[]; animate?: boolean }) {
  return (
    <MasonryGrid<Card>
      items={cards}
      getKey={(card) => card.id}
      getFrame={(card) => ({ width: card.width, height: card.height })}
      renderItem={(card) => <CardFace card={card} />}
      minColumnWidth={140}
      gap={12}
      animate={animate}
      shouldGrowIn={(card) => card.fresh === true}
    />
  );
}

function transforms(canvasElement: HTMLElement): Map<string, string> {
  return new Map(
    [...canvasElement.querySelectorAll<HTMLElement>("[data-grid-item]")].map(
      (cell) => [cell.dataset.gridItem ?? "", cell.style.transform],
    ),
  );
}

const meta = {
  title: "Masonry/MasonryGrid",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Static: Story = {
  render: () => <Grid cards={makeCards(16)} animate={false} />,
};

// Fewer cards than columns: normal-width columns, centred
export const FewItems: Story = {
  render: () => <Grid cards={makeCards(2)} animate={false} />,
};

function AppendingGrid() {
  const [cards, setCards] = useState(() => makeCards(10));
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          setCards((prev) => [...prev, ...makeCards(7, prev.length)])
        }
      >
        Load more
      </Button>
      <Grid cards={cards} />
    </div>
  );
}

// Appending a page never moves cards already on screen
export const AppendPage: Story = {
  render: () => <AppendingGrid />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = transforms(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(transforms(canvasElement).size).toBe(17));
    const after = transforms(canvasElement);
    for (const [key, transform] of before) {
      expect(after.get(key)).toBe(transform);
    }
  },
};

function ReshapingGrid() {
  const [cards, setCards] = useState(() => makeCards(12));
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          setCards((prev) =>
            prev.map((card, index) =>
              index === 0 ? { ...card, height: card.height * 2 } : card,
            ),
          )
        }
      >
        Make the first card taller
      </Button>
      <Grid cards={cards} />
    </div>
  );
}

// A card changing shape only moves the cards below it in its own column
export const ShapeChange: Story = {
  render: () => <ReshapingGrid />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const columnOf = (transform: string | undefined) =>
      transform?.match(/translate3d\(([\d.]+)px/)?.[1];
    const before = transforms(canvasElement);
    const firstColumn = columnOf(before.get("card-0"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Make the first card taller" }),
    );
    const after = transforms(canvasElement);
    for (const [key, transform] of before) {
      // Same column for everyone; other columns don't move at all
      expect(columnOf(after.get(key))).toBe(columnOf(transform));
      if (columnOf(transform) !== firstColumn) {
        expect(after.get(key)).toBe(transform);
      }
    }
  },
};

function GrowingGrid() {
  const [cards, setCards] = useState(() => makeCards(9));
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          setCards((prev) => [
            { ...makeCards(1, prev.length)[0], fresh: true },
            ...prev,
          ])
        }
      >
        Add to top
      </Button>
      <Grid cards={cards} />
    </div>
  );
}

// A new card at the top grows in and only pushes its own column down
export const GrowIn: Story = {
  render: () => <GrowingGrid />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const columnOf = (transform: string | undefined) =>
      transform?.match(/translate3d\(([\d.]+)px/)?.[1];
    const before = transforms(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add to top" }));

    const cell = await waitFor(() => {
      const added = canvasElement.querySelector<HTMLElement>(
        '[data-grid-item="card-9"]',
      );
      if (!added) throw new Error("not added yet");
      return added;
    });
    // Starts collapsed, then grows to its full height
    await waitFor(() =>
      expect(cell.getBoundingClientRect().height).toBeGreaterThan(50),
    );
    const newColumn = columnOf(cell.style.transform);
    const after = transforms(canvasElement);
    for (const [key, transform] of before) {
      if (columnOf(transform) !== newColumn) {
        expect(after.get(key)).toBe(transform);
      }
    }
  },
};
