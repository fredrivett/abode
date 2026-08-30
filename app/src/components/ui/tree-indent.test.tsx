import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TreeIndent } from "./tree-indent";

describe("TreeIndent", () => {
  it("renders nothing at depth 0 (a top-level row)", () => {
    const { container } = render(<TreeIndent depth={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one connector plus (depth - 1) spacer gutters", () => {
    const { container } = render(<TreeIndent depth={3} />);
    // one connector icon at the deepest gutter
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    // depth gutters total: 2 spacers + 1 connector
    const wrapper = container.firstElementChild;
    expect(wrapper?.children).toHaveLength(3);
  });

  it("is hidden from assistive tech (decorative)", () => {
    const { container } = render(<TreeIndent depth={1} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
