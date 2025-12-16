import { isValidElement, type ReactNode, type ReactElement } from "react";

type PropsWithChildren = { children?: ReactNode };

/**
 * Recursively extracts text content from React children.
 * Handles strings, numbers, arrays, and React elements with nested children.
 */
export function getTextFromChildren(children: ReactNode): string {
  if (typeof children === "string") {
    return children;
  }
  if (typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join("");
  }
  if (isValidElement(children)) {
    const element = children as ReactElement<PropsWithChildren>;
    if (element.props.children) {
      return getTextFromChildren(element.props.children);
    }
  }
  return "";
}
