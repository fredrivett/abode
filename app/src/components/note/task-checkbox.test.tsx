import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskCheckbox } from "./task-checkbox";

describe("TaskCheckbox", () => {
  it("renders a checkbox as an inert, hidden box carrying its checked state", () => {
    const { container, rerender } = render(<TaskCheckbox type="checkbox" />);
    const box = container.querySelector("[data-task-checkbox]");
    expect(box?.tagName).toBe("SPAN");
    expect(box).toHaveAttribute("aria-hidden", "true");
    expect(box).toHaveAttribute("data-checked", "false");

    rerender(<TaskCheckbox type="checkbox" checked />);
    expect(container.querySelector("[data-task-checkbox]")).toHaveAttribute(
      "data-checked",
      "true",
    );
  });

  it("renders nothing for any other input type", () => {
    const { container } = render(<TaskCheckbox type="text" />);
    expect(container).toBeEmptyDOMElement();
  });
});
