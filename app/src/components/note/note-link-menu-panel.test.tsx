import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoteLinkMenuPanel } from "./note-link-menu-panel";

function renderPanel(
  props: Partial<Parameters<typeof NoteLinkMenuPanel>[0]> = {},
) {
  const handlers = {
    onOpen: vi.fn(),
    onCopy: vi.fn().mockResolvedValue(true),
    onSave: vi.fn(),
    onRemove: vi.fn(),
    onCancelEdit: vi.fn(),
    onEditBlur: vi.fn(),
  };
  render(
    <NoteLinkMenuPanel
      href="https://www.example.com/article"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("NoteLinkMenuPanel", () => {
  it("shows the compact URL as a link", () => {
    renderPanel();
    expect(
      screen.getByRole("link", { name: "example.com/article" }),
    ).toHaveAttribute("href", "https://www.example.com/article");
  });

  it("opens via the Open button and via the URL", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Open link" }));
    await user.click(screen.getByRole("link"));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("doesn't offer to open an unsafe href", () => {
    renderPanel({ href: "javascript:alert(1)" });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Open link" })).toBeDisabled();
  });

  it("confirms a copy", async () => {
    const user = userEvent.setup();
    const { onCopy } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(onCopy).toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
  });

  it("doesn't confirm a failed copy", async () => {
    const user = userEvent.setup();
    renderPanel({ onCopy: vi.fn().mockResolvedValue(false) });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(screen.getByRole("button", { name: "Copy link" })).toBeVisible();
  });

  it("removes the link", async () => {
    const user = userEvent.setup();
    const { onRemove } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Remove link" }));
    expect(onRemove).toHaveBeenCalled();
  });

  describe("editing", () => {
    it("prefills the current href, focused", async () => {
      const user = userEvent.setup();
      renderPanel();
      await user.click(screen.getByRole("button", { name: "Edit link" }));
      const input = screen.getByRole("textbox", { name: "Link address" });
      expect(input).toHaveValue("https://www.example.com/article");
      await waitFor(() => expect(input).toHaveFocus());
    });

    it("saves a normalised href on Enter and returns to the actions", async () => {
      const user = userEvent.setup();
      const { onSave } = renderPanel({ defaultEditing: true });
      const input = screen.getByRole("textbox", { name: "Link address" });
      await user.clear(input);
      await user.type(input, "abode.fyi/help{Enter}");
      expect(onSave).toHaveBeenCalledWith("https://abode.fyi/help");
      expect(
        screen.getByRole("button", { name: "Edit link" }),
      ).toBeInTheDocument();
    });

    it("rejects an invalid href and stays in the form", async () => {
      const user = userEvent.setup();
      const { onSave } = renderPanel({ defaultEditing: true });
      const input = screen.getByRole("textbox", { name: "Link address" });
      await user.clear(input);
      await user.type(input, "javascript:alert(1){Enter}");
      expect(onSave).not.toHaveBeenCalled();
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("cancels on Escape without the key reaching outer handlers", async () => {
      const user = userEvent.setup();
      const outer = vi.fn();
      document.addEventListener("keydown", outer, { capture: true });
      const { onCancelEdit, onSave } = renderPanel({ defaultEditing: true });
      const input = screen.getByRole("textbox", { name: "Link address" });
      await waitFor(() => expect(input).toHaveFocus());
      await user.keyboard("{Escape}");
      document.removeEventListener("keydown", outer, { capture: true });

      expect(onCancelEdit).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
      expect(outer).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Edit link" }),
      ).toBeInTheDocument();
    });

    it("drops the edit when focus leaves the form", () => {
      const { onEditBlur, onSave } = renderPanel({ defaultEditing: true });
      const input = screen.getByRole("textbox", { name: "Link address" });
      fireEvent.blur(input, { relatedTarget: document.body });
      expect(onEditBlur).toHaveBeenCalledWith(document.body);
      expect(onSave).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Edit link" }),
      ).toBeInTheDocument();
    });

    it("stays in the form when focus moves within it", () => {
      const { onEditBlur } = renderPanel({ defaultEditing: true });
      const input = screen.getByRole("textbox", { name: "Link address" });
      fireEvent.blur(input, {
        relatedTarget: screen.getByRole("button", { name: "Save link" }),
      });
      expect(onEditBlur).not.toHaveBeenCalled();
    });
  });
});
