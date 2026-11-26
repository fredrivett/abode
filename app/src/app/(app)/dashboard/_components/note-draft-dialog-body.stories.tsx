import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, waitFor } from "storybook/test";
import { Dialog } from "@/components/ui/dialog";
import type { Item } from "@/lib/types/item";
import { ItemDetailBody } from "../item-card";
import { NoteDraftProvider } from "../note-draft-context";
import { NoteDraftDialogBody } from "./note-draft-dialog-body";

const NOW = "2026-11-26T12:00:00.000Z";

// A freshly saved composer note: what the draft dialog becomes on Save
const savedNote: Item = {
  id: "33333333-3333-4333-8333-333333333333",
  kind: "note",
  processingStatus: "completed",
  fileKey: null,
  coverFileKey: null,
  faviconFileKey: null,
  meta: null,
  sourceType: "compose",
  sourceUrl: null,
  captureSource: "web",
  title: "Trip ideas",
  description: null,
  tags: [],
  userTags: [],
  notes: null,
  createdAt: NOW,
  addedAt: NOW,
  objects: [],
  colors: [],
  ocrText: null,
  captureDate: null,
  blurDataUrl: null,
  locations: [],
  articleDetails: null,
  twitterDetails: null,
  instagramDetails: null,
  videoDetails: null,
  productDetails: null,
  bookDetails: null,
  noteDetails: { content: "Lisbon, Porto, then the coast down to Faro." },
  rooms: [],
  externalLinks: [],
};

// The item dialog frame's two-column body, at a desktop size
function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      data-frame={label}
      className="relative flex h-[900px] w-[1400px] flex-row overflow-hidden border"
    >
      {children}
    </div>
  );
}

function Comparison() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="flex flex-col gap-4">
        <Dialog open>
          <Frame label="draft">
            <NoteDraftProvider
              initialDraft={`# ${savedNote.title}\n\n${savedNote.noteDetails?.content}`}
            >
              <NoteDraftDialogBody />
            </NoteDraftProvider>
          </Frame>
        </Dialog>
        <Dialog open>
          <Frame label="saved">
            <ItemDetailBody
              item={savedNote}
              size="0 B"
              previewUrl={null}
              imageFileKey={null}
              open
              onOpenChange={() => {}}
              name={savedNote.title ?? ""}
              onNameChange={() => {}}
              canEdit
              animateEntrance={false}
            />
          </Frame>
        </Dialog>
      </div>
    </QueryClientProvider>
  );
}

// The sidebar fetches rooms and similar items; answer with empty lists
function withEmptyApi() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("[]", { headers: { "Content-Type": "application/json" } });
  return () => {
    globalThis.fetch = realFetch;
  };
}

/**
 * The expanded composer's ghost sidebar against the real sidebar of the note
 * it saves as. Save fills the ghost in place, so its sections must match the
 * real ones: same names, same order, same heights. The play test fails when a
 * sidebar section is added, moved or resized without updating the ghost.
 */
const meta = {
  title: "Note/NoteDraftDialogBody",
  component: Comparison,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  beforeEach: withEmptyApi,
} satisfies Meta<typeof Comparison>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GhostMatchesSavedSidebar: Story = {
  play: async ({ canvasElement }) => {
    const headings = (label: string) => {
      const frame = canvasElement.querySelector(`[data-frame="${label}"]`);
      if (!(frame instanceof HTMLElement)) throw new Error(`no ${label}`);
      const top = frame.getBoundingClientRect().top;
      return [...frame.querySelectorAll("h3")].map((h) => ({
        // "Rooms (private)" → "Rooms"
        name: h.textContent?.trim().split(/\s|\(/)[0],
        y: Math.round(h.getBoundingClientRect().top - top),
      }));
    };
    await waitFor(() =>
      expect(headings("saved").map(({ name }) => name)).toContain("Notes"),
    );
    const ghost = headings("draft");
    const saved = headings("saved");
    // Every section down to the ghost's last one, in order and in place
    expect(saved.slice(0, ghost.length)).toEqual(ghost);
  },
};
