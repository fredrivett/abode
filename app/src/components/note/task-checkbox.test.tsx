import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskCheckbox } from "./task-checkbox";

describe("TaskCheckbox", () => {
  it("renders a checkbox as an inert box that speaks its checked state", () => {
    const { container, rerender } = render(<TaskCheckbox type="checkbox" />);
    const box = container.querySelector("[data-task-checkbox]");
    expect(box?.tagName).toBe("SPAN");
    expect(box).toHaveAttribute("data-checked", "false");
    expect(box).toHaveTextContent("Unchecked:");

    rerender(<TaskCheckbox type="checkbox" checked />);
    const checked = container.querySelector("[data-task-checkbox]");
    expect(checked).toHaveAttribute("data-checked", "true");
    expect(checked).toHaveTextContent("Checked:");
  });

  it("renders nothing for any other input type", () => {
    const { container } = render(<TaskCheckbox type="text" />);
    expect(container).toBeEmptyDOMElement();
  });
});
