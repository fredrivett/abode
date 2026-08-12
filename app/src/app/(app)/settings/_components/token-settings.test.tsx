import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonalAccessTokenSummary } from "@/lib/personal-access-tokens";
import { TokenSettings } from "./token-settings";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/copy", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

function summary(
  over: Partial<PersonalAccessTokenSummary> = {},
): PersonalAccessTokenSummary {
  return {
    id: "t1",
    name: "Existing",
    tokenPrefix: "abode_pat_abc123",
    scopes: ["read"],
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TokenSettings", () => {
  it("shows an empty state when there are no tokens", () => {
    render(<TokenSettings initialTokens={[]} />);
    expect(screen.getByText("No tokens yet")).toBeInTheDocument();
  });

  it("lists existing tokens with their display prefix", () => {
    render(<TokenSettings initialTokens={[summary({ name: "Existing" })]} />);
    expect(screen.getByText("Existing")).toBeInTheDocument();
    expect(screen.getByText(/abode_pat_abc123/)).toBeInTheDocument();
  });

  it("creates a token, reveals it once, and adds it to the list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "abode_pat_SECRETVALUE",
        tokenSummary: summary({ id: "t2", name: "Claude Desktop" }),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TokenSettings initialTokens={[]} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Claude Desktop"), {
      target: { value: "Claude Desktop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    // The raw token is revealed once in the dialog
    await waitFor(() =>
      expect(screen.getByTestId("new-token-value")).toHaveTextContent(
        "abode_pat_SECRETVALUE",
      ),
    );

    // Default expiry ("No expiry") posts null
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/tokens",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Claude Desktop", expiresInDays: null }),
      }),
    );

    // The new token appears in the list
    expect(screen.getByText("Claude Desktop")).toBeInTheDocument();
  });

  it("revokes a token on a two-step confirm and removes the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TokenSettings
        initialTokens={[summary({ id: "t1", name: "Revoke me" })]}
      />,
    );

    const revokeButton = screen.getByRole("button", { name: "Revoke token" });
    // First click arms the confirm, second click revokes
    fireEvent.click(revokeButton);
    fireEvent.click(screen.getByRole("button", { name: "Revoke token" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/tokens/t1", {
        method: "DELETE",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Revoke me")).not.toBeInTheDocument(),
    );
  });

  it("does not revoke on the first click alone", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TokenSettings
        initialTokens={[summary({ id: "t1", name: "Revoke me" })]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke token" }));

    expect(screen.getByText("Confirm revoke?")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
