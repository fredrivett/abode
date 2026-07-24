import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Filter } from "@/lib/search/types";
import { FilterBadges } from "./filter-badges";

describe("FilterBadges", () => {
  it("renders nothing when filters is not an array (malformed data)", () => {
    // A bad room.filters shape (e.g. legacy { kind: [...] }) must not crash
    const { container } = render(
      <FilterBadges filters={{ kind: ["video"] } as unknown as Filter[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty filter array", () => {
    const { container } = render(<FilterBadges filters={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
