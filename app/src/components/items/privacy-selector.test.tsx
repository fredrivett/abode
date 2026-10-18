import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacySelector } from "./privacy-selector";

describe("PrivacySelector", () => {
  it("is one labelled single-choice group, least to most restrictive", () => {
    render(<PrivacySelector value="unlisted" onChange={() => {}} />);

    expect(screen.getByRole("group", { name: "Privacy" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
      expect.stringContaining("Default"),
      expect.stringContaining("Keep out of public rooms"),
      expect.stringContaining("Sensitive"),
    ]);
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
    expect(radios[2]).not.toBeChecked();
  });

  it("spells out public rooms and link sharing for every level", () => {
    render(<PrivacySelector value="standard" onChange={() => {}} />);

    for (const radio of screen.getAllByRole("radio")) {
      const option = radio.closest("label");
      expect(option).toHaveTextContent(/public rooms/);
      expect(option).toHaveTextContent(/shared by link/);
    }
  });

  it("reports a newly chosen level", () => {
    const onChange = vi.fn();
    render(<PrivacySelector value="standard" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Sensitive/ }));
    expect(onChange).toHaveBeenCalledWith("sensitive");
  });

  it("ignores a click on the current level", () => {
    const onChange = vi.fn();
    render(<PrivacySelector value="sensitive" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Sensitive/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables every option while saving", () => {
    render(<PrivacySelector value="standard" onChange={() => {}} disabled />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});
