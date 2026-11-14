import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  apiPost: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: m.replace }),
}));
vi.mock("@/lib/api-client", () => ({ api: { post: m.apiPost } }));
vi.mock("@/lib/api-hooks", () => ({ useInvalidateItems: () => vi.fn() }));
vi.mock("posthog-js", () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));
vi.mock("@/lib/logger.client", () => ({
  createLogger: () => ({ error: vi.fn() }),
}));
vi.mock("@/stores/milestone-store", () => ({
  useMilestoneStore: { getState: () => ({ markComplete: vi.fn() }) },
}));

import { SaveRedirect } from "./save-redirect";

beforeEach(() => vi.clearAllMocks());

describe("SaveRedirect", () => {
  it("lands on the processing toast for a save that is still processing", async () => {
    m.apiPost.mockResolvedValue({ processingStatus: "processing" });
    render(<SaveRedirect url="https://example.com/a" />);
    await waitFor(() =>
      expect(m.replace).toHaveBeenCalledWith("/dashboard?share=saved"),
    );
  });

  it("lands on the plain saved toast for a save that completed", async () => {
    m.apiPost.mockResolvedValue({ processingStatus: "completed" });
    render(<SaveRedirect url="https://example.com/a" />);
    await waitFor(() =>
      expect(m.replace).toHaveBeenCalledWith("/dashboard?share=saved_link"),
    );
  });
});
