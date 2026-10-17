import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setInviteAllocationAsAdmin, toastError } = vi.hoisted(() => ({
  setInviteAllocationAsAdmin: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: toastError },
}));

import { InviteAllocationEditor } from "./invite-allocation-editor";

const usage = { allocation: 3, used: 2, available: 1 };

function renderEditor() {
  render(
    <InviteAllocationEditor
      userId="user-1"
      initialUsage={usage}
      saveAllocation={setInviteAllocationAsAdmin}
    />,
  );
}

function edit(value: string) {
  fireEvent.click(screen.getByRole("button", { name: "Edit invites" }));
  fireEvent.change(screen.getByLabelText("Invites"), {
    target: { value },
  });
}

beforeEach(() => {
  setInviteAllocationAsAdmin.mockReset();
  toastError.mockReset();
});

describe("InviteAllocationEditor", () => {
  it("shows used, allocation and what's left", () => {
    renderEditor();
    expect(screen.getByText(/used of/)).toHaveTextContent(
      "2 used of 3 · 1 left",
    );
  });

  it("saves a new allocation and shows the updated usage", async () => {
    setInviteAllocationAsAdmin.mockResolvedValue({
      success: true,
      usage: { allocation: 10, used: 2, available: 8 },
    });
    renderEditor();
    edit("10");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(setInviteAllocationAsAdmin).toHaveBeenCalledWith({
      userId: "user-1",
      allocation: 10,
    });
    await waitFor(() =>
      expect(screen.getByText(/used of/)).toHaveTextContent(
        "2 used of 10 · 8 left",
      ),
    );
  });

  it.each(["-1", "2.5", "", "1001"])(
    "won't save an invalid value (%j)",
    (value) => {
      renderEditor();
      edit(value);
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    },
  );

  it("won't save an unchanged value", () => {
    renderEditor();
    edit("3");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("warns when the new allocation is below what's already used", () => {
    renderEditor();
    edit("1");
    expect(screen.getByText(/they'll have none left/)).toBeInTheDocument();
  });

  it("keeps the editor open and reports a failed save", async () => {
    setInviteAllocationAsAdmin.mockResolvedValue({ error: "Nope" });
    renderEditor();
    edit("5");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Nope"));
    expect(screen.getByLabelText("Invites")).toBeInTheDocument();
  });

  it("cancels without saving", () => {
    renderEditor();
    edit("9");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(setInviteAllocationAsAdmin).not.toHaveBeenCalled();
    expect(screen.getByText(/used of/)).toHaveTextContent(
      "2 used of 3 · 1 left",
    );
  });
});
