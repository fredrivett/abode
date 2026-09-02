import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepRail } from "./step-rail";

// The rail is decorative (aria-hidden, no text/roles), so we assert on the
// rendered fill: the active branch renders a pill whose height tracks progress;
// the inactive branch renders a plain dot with no fill.
const fillOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(".bg-gradient-to-b");

describe("StepRail", () => {
  it("renders a dot with no fill when inactive", () => {
    const { container } = render(<StepRail active={false} progress={0.5} />);
    expect(fillOf(container)).toBeNull();
  });

  it("fills the pill in proportion to progress when active", () => {
    const { container } = render(<StepRail active={true} progress={0.5} />);
    expect(fillOf(container)?.style.height).toBe("50%");
  });

  it("floors the fresh (progress 0) fill at 10% so it reads as a pill", () => {
    const { container } = render(<StepRail active={true} progress={0} />);
    expect(fillOf(container)?.style.height).toBe("10%");
  });

  it("fills to 100% at the end of the band", () => {
    const { container } = render(<StepRail active={true} progress={1} />);
    expect(fillOf(container)?.style.height).toBe("100%");
  });
});
