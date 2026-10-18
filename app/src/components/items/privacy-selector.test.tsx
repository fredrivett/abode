import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacySelector } from "./privacy-selector";

describe("PrivacySelector", () => {
  it("lists every level, least to most restrictive, marking the current one", () => {
    render(<PrivacySelector value="unlisted" onChange={() => {}} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining("Default"),
      expect.stringContaining("Keep out of public rooms"),
      expect.stringContaining("Sensitive"),
    ]);
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("spells out public rooms and link sharing for every level", () => {
    render(<PrivacySelector value="standard" onChange={() => {}} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveTextContent(/public rooms/);
      expect(button).toHaveTextContent(/shared by link/);
    }
  });

  it("reports a newly chosen level", () => {
    const onChange = vi.fn();
    render(<PrivacySelector value="standard" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Sensitive/ }));
    expect(onChange).toHaveBeenCalledWith("sensitive");
  });

  it("ignores a click on the current level", () => {
    const onChange = vi.fn();
    render(<PrivacySelector value="sensitive" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Sensitive/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables every option while saving", () => {
    render(<PrivacySelector value="standard" onChange={() => {}} disabled />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
