import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { expect, waitFor } from "storybook/test";
import { Button } from "@/components/ui/button";
import { NoteDetailLayout } from "./note-detail-layout";
import { NoteDetailPlaceholder } from "./note-detail-placeholder";
import { NoteEditor } from "./note-editor";

const SAMPLE = `# Weekly review

Things that went **well** this week:

- Shipped the note item type
- Cleared the review backlog

> Markdown is the source of truth.`;

// Read-only by design: this is the brief stand-in shown while the note editor
// (a large lazy chunk) loads, before the editor replaces it in place. For the
// editable note, see Note/NoteEditor.
const meta = {
  title: "Note/NoteDetailPlaceholder",
  component: NoteDetailPlaceholder,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Read-only stand-in shown while the note editor loads: the note's text in the editor's layout, so the editor takes over in place. Not editable — see Note/NoteEditor for the editor.",
      },
    },
  },
  tags: ["autodocs"],
  args: { content: SAMPLE, canEdit: true },
  decorators: [
    (Story) => (
      <div className="h-[32rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoteDetailPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

// For the note's owner: reserves the editor's "Saving" status row
export const ForOwner: Story = {};

// For a viewer who can't edit: no status row
export const ForViewer: Story = { args: { canEdit: false } };

// The editor side of the swap: what NoteDetailView renders (minus saving)
function EditorView({ canEdit }: { canEdit: boolean }) {
  return (
    <NoteDetailLayout footer={canEdit ? null : undefined}>
      <NoteEditor content={SAMPLE} editable={canEdit} />
    </NoteDetailLayout>
  );
}

function SwapDemo() {
  const [showEditor, setShowEditor] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button size="sm" onClick={() => setShowEditor((shown) => !shown)}>
          {showEditor ? "Show placeholder" : "Show editor"}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {showEditor ? (
          <EditorView canEdit />
        ) : (
          <NoteDetailPlaceholder content={SAMPLE} canEdit />
        )}
      </div>
    </div>
  );
}

// Flick between the placeholder and the editor that replaces it: nothing
// should move
export const Swap: Story = {
  render: () => <SwapDemo />,
};

// The editor laid over the placeholder, tinted and semi-transparent: any
// mismatch shows as a doubled image. The play test checks the text lines up.
export const Overlay: Story = {
  render: () => (
    <div className="relative h-full">
      <div data-layer="placeholder" className="absolute inset-0">
        <NoteDetailPlaceholder content={SAMPLE} canEdit />
      </div>
      <div
        data-layer="editor"
        className="pointer-events-none absolute inset-0 opacity-60 [&_*]:text-red-500!"
      >
        <EditorView canEdit />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const layer = (name: string) => {
      const element = canvasElement.querySelector(`[data-layer="${name}"]`);
      if (!(element instanceof HTMLElement)) throw new Error(`no ${name}`);
      return element;
    };
    // The editor initialises after mount
    await waitFor(() =>
      expect(layer("editor").querySelector(".ProseMirror")).not.toBeNull(),
    );
    // Where the text itself starts (not its element: the editor wraps list
    // items' text in a <p>, the placeholder doesn't)
    const topOf = (name: string, text: string) => {
      const walker = document.createTreeWalker(
        layer(name),
        NodeFilter.SHOW_TEXT,
      );
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.includes(text)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getClientRects()[0];
        return { text, x: Math.round(rect.x), y: Math.round(rect.y) };
      }
      throw new Error(`"${text}" not in ${name}`);
    };
    for (const text of [
      "Weekly review",
      "Things that went",
      "Shipped the note",
      "Cleared the review",
      "Markdown is the source",
    ]) {
      expect(topOf("editor", text)).toEqual(topOf("placeholder", text));
    }
  },
};
