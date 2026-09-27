import { act, render, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SERVER_MODIFIER_KEY_SYMBOL,
  useModifierKeySymbol,
} from "./use-modifier-key-symbol";

const APPLE = { userAgentData: { platform: "macOS" } };

// Hydrated roots aren't tracked by RTL's cleanup, so they're unmounted in
// afterEach (even when a test fails)
const hydratedRoots: Root[] = [];
const NON_APPLE = { userAgentData: { platform: "Windows" } };

function Probe({ onRender }: { onRender?: (symbol: string) => void }) {
  const symbol = useModifierKeySymbol();
  onRender?.(symbol);
  return <kbd>{symbol}</kbd>;
}

// Server-render on one platform, then hydrate in a browser on another,
// recording every value the hook renders and any hydration errors
async function serverRenderThenHydrate({
  server,
  client,
}: {
  server: object;
  client: object;
}) {
  vi.stubGlobal("navigator", server);
  const html = renderToString(<Probe />);

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  vi.stubGlobal("navigator", client);
  const renders: string[] = [];
  const errors: unknown[] = [];
  await act(async () => {
    hydratedRoots.push(
      hydrateRoot(
        container,
        <Probe onRender={(symbol) => renders.push(symbol)} />,
        { onRecoverableError: (error) => errors.push(error) },
      ),
    );
  });

  return { html, renders, errors, text: container.textContent };
}

describe("useModifierKeySymbol", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    for (const root of hydratedRoots.splice(0)) act(() => root.unmount());
    vi.stubGlobal("navigator", originalNavigator);
    document.body.innerHTML = "";
  });

  it("server-renders the stable default whatever the server's platform", () => {
    for (const platform of [APPLE, NON_APPLE]) {
      vi.stubGlobal("navigator", platform);
      expect(renderToString(<Probe />)).toBe(
        `<kbd>${SERVER_MODIFIER_KEY_SYMBOL}</kbd>`,
      );
    }
  });

  it("hydrates with the default, then switches to Ctrl on non-Apple", async () => {
    const { renders, errors, text } = await serverRenderThenHydrate({
      server: APPLE,
      client: NON_APPLE,
    });
    expect(errors).toEqual([]);
    expect(renders[0]).toBe(SERVER_MODIFIER_KEY_SYMBOL);
    expect(renders.at(-1)).toBe("Ctrl");
    expect(text).toBe("Ctrl");
  });

  it("hydrates with the default and stays ⌘ on Apple", async () => {
    const { renders, errors, text } = await serverRenderThenHydrate({
      server: NON_APPLE,
      client: APPLE,
    });
    expect(errors).toEqual([]);
    expect(renders[0]).toBe(SERVER_MODIFIER_KEY_SYMBOL);
    expect(renders.at(-1)).toBe("⌘");
    expect(text).toBe("⌘");
  });

  it("returns the platform symbol immediately on a client-only render", () => {
    vi.stubGlobal("navigator", NON_APPLE);
    const renders: string[] = [];
    render(<Probe onRender={(symbol) => renders.push(symbol)} />);
    expect(renders).toEqual(["Ctrl"]);
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
  });
});
