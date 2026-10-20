import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookAuthors } from "./book-authors";

describe("BookAuthors", () => {
  it("credits the authors with an italic 'by'", () => {
    const { container } = render(
      <BookAuthors authors={["Donella H. Meadows", "Diana Wright"]} />,
    );
    expect(container).toHaveTextContent("by Donella H. Meadows, Diana Wright");
    expect(container.querySelector("em")).toHaveTextContent("by");
  });

  it("renders nothing without authors", () => {
    const { container } = render(<BookAuthors authors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
