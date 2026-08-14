"use client";

import { BalancedMasonryGrid } from "@masonry-grid/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ItemFrame } from "./item-frame";

/**
 * Verifies the grid grow-in against the real masonry engine (with plain colour
 * blocks instead of the provider-heavy ItemCard). "Add item" prepends a fresh
 * frame that grows from zero height into the grid while its neighbours slide
 * down to make room — the same path a newly-uploaded item takes.
 */

const FRAME_WIDTH = 180;
const GAP = 12;
const FRAME_TRANSITION = "transform 0.3s ease, aspect-ratio 0.3s ease";
const ASPECTS: Array<[number, number]> = [
  [3, 4],
  [1, 1],
  [16, 9],
  [4, 5],
  [3, 2],
  [2, 3],
];

type Box = { id: number; width: number; height: number; fresh: boolean };

function makeBox(id: number, fresh: boolean): Box {
  const [width, height] = ASPECTS[id % ASPECTS.length];
  return { id, width, height, fresh };
}

function GrowInDemo() {
  const [boxes, setBoxes] = useState<Box[]>(() =>
    Array.from({ length: 9 }, (_, i) => makeBox(i, false)),
  );
  const [nextId, setNextId] = useState(9);

  const addOne = () => {
    setBoxes((prev) => [makeBox(nextId, true), ...prev]);
    setNextId((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={addOne}
        className="w-fit rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm"
      >
        Add item
      </button>
      {/* 4 columns × FRAME_WIDTH + 3 gaps, so columns are exactly FRAME_WIDTH
          and the settled aspect height matches the animated target px. */}
      <div style={{ width: 4 * FRAME_WIDTH + 3 * GAP }}>
        <BalancedMasonryGrid
          frameWidth={FRAME_WIDTH}
          gap={GAP}
          style={{ overflow: "visible !important" }}
        >
          {boxes.map((box) => (
            <ItemFrame
              key={box.id}
              width={box.width}
              height={box.height}
              columnWidth={FRAME_WIDTH}
              frameTransition={FRAME_TRANSITION}
              animateIn={box.fresh}
            >
              <div
                className="flex h-full w-full items-center justify-center rounded-lg font-semibold text-white"
                style={{
                  backgroundColor: `hsl(${(box.id * 57) % 360} 55% 48%)`,
                }}
              >
                {box.id}
              </div>
            </ItemFrame>
          ))}
        </BalancedMasonryGrid>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Dashboard/Grid Grow-in",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj;

/** Click "Add item" to watch a fresh frame grow into the grid. */
export const Interactive: Story = {
  render: () => <GrowInDemo />,
};
