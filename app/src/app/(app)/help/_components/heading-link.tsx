"use client";

import { Hash } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  const [isHighlighted, setIsHighlighted] = useState(false);
  const text = getTextFromChildren(children);
  const baseId = slugify(text);
  const id = getOrCreateId(instanceKey, baseId);
  const Tag = `h${level}` as const;

  const triggerHighlight = useCallback(() => {
    setIsHighlighted(true);
    setTimeout(() => setIsHighlighted(false), 1500);
  }, []);

  const scrollAndHighlight = useCallback(() => {
    headingRef.current?.scrollIntoView({ behavior: "smooth" });
    triggerHighlight();
  }, [triggerHighlight]);

  // Handle initial page load with hash
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === id && headingRef.current) {
      requestAnimationFrame(() => {
        scrollAndHighlight();
      });
    }
  }, [id, scrollAndHighlight]);

  // Intercept clicks on anchor links to this heading for smooth scroll
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor?.hash === `#${id}`) {
        e.preventDefault();
        window.history.pushState(null, "", anchor.hash);
        scrollAndHighlight();
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [id, scrollAndHighlight]);

  const handleClick = () => {
    const url = `${window.location.pathname}#${id}`;
    window.history.replaceState(null, "", url);
    navigator.clipboard.writeText(window.location.href);
    toast("Link copied to clipboard");
    scrollAndHighlight();
  };

  return (
    <Tag
      ref={headingRef}
      id={id}
      className={cn(
        "group -mx-2.5 -my-1.5 relative scroll-mt-20 rounded-md px-2.5 py-1.5 transition-all duration-500",
        isHighlighted && "scale-[1.075] bg-muted shadow-xl",
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        className="-translate-x-full -translate-y-1/2 hover:!opacity-100 absolute top-1/2 left-0 cursor-pointer pr-1 opacity-0 transition-opacity group-hover:opacity-50"
        aria-label={`Copy link to ${text}`}
      >
        <Hash className="size-[1em]" />
      </button>
      {children}
    </Tag>
  );
}
