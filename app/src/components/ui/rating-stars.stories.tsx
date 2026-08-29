import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RatingStars } from "./rating-stars";

const RatingStarsDemo = ({
  initialRating,
}: {
  initialRating: number | null;
}) => {
  const [rating, setRating] = useState(initialRating);
  return (
    <div className="flex flex-col items-start gap-2">
      <RatingStars rating={rating} onChange={setRating} />
      <p className="text-muted-foreground text-sm">
        Stored value: {rating ?? "—"}/10
      </p>
    </div>
  );
};

const meta = {
  title: "UI/RatingStars",
  component: RatingStarsDemo,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof RatingStarsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unrated: Story = {
  args: { initialRating: null },
};

export const HalfStar: Story = {
  args: { initialRating: 9 },
};

export const FullyRated: Story = {
  args: { initialRating: 10 },
};
