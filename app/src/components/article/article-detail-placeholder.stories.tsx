import type { Meta, StoryObj } from "@storybook/nextjs";
import { ArticleDetailPlaceholder } from "./article-detail-placeholder";

const meta = {
  title: "Article/ArticleDetailPlaceholder",
  component: ArticleDetailPlaceholder,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { title: "How to make everything slightly better" },
  decorators: [
    (Story) => (
      <div className="flex h-[32rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleDetailPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTitle: Story = {};

export const WithoutTitle: Story = { args: { title: undefined } };
