"use client";

import { useEffect, useId, useRef } from "react";
import { Hash } from "lucide-react";
import { toast } from "sonner";
import { useHeadingId } from "./heading-id-context";
import { getTextFromChildren } from "./utils/get-text-from-children";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

type HeadingLinkProps = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
};

export function HeadingLink({ level, children }: HeadingLinkProps) {
  const { getOrCreateId } = useHeadingId();
  const instanceKey = useId(); // Stable key for this component instance
  const headingRef = useRef<HTMLHeadingElement>(null);
  const text = getTextFromChildren(children);
  const baseId = slugify(text);
  const id = getOrCreateId(instanceKey, baseId);
  const Tag = `h${level}` as const;

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === id && headingRef.current) {
      requestAnimationFrame(() => {
        headingRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [id]);

  const handleClick = () => {
    const url = `${window.location.pathname}#${id}`;
    window.history.replaceState(null, "", url);
    navigator.clipboard.writeText(window.location.href);
    toast("Link copied to clipboard");
    headingRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Tag ref={headingRef} id={id} className="group relative">
      <button
        type="button"
        onClick={handleClick}
        className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 cursor-pointer pr-2 opacity-0 transition-opacity group-hover:opacity-50 hover:!opacity-100"
        aria-label={`Copy link to ${text}`}
      >
        <Hash className="size-4" />
      </button>
      {children}
    </Tag>
  );
}
