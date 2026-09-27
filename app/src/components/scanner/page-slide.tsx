"use client";

import { useEffect, useRef, useState } from "react";
import { IsLoading } from "@/components/ui/is-loading";
import type { Size } from "@/lib/scanner/geometry";
import { cn } from "@/lib/utils";
import type { ScreenRect } from "./scanner-camera";
import type { PagePreview } from "./use-page-previews";

const FLIGHT_MS = 450;

/** Largest size with the page's aspect ratio that fits inside `box` */
export function containSize({ page, box }: { page: Size; box: Size }): Size {
  const scale = Math.min(box.width / page.width, box.height / page.height);
  return {
    width: Math.floor(page.width * scale),
    height: Math.floor(page.height * scale),
  };
}

interface PageSlideProps {
  /** Preview in the page's chosen filter */
  preview: PagePreview | undefined;
  /** Space available for the page */
  box: Size;
  /**
   * Set for a just-captured page: the colour preview flies in from the
   * page's spot in the camera view, then the filtered preview fades over it.
   */
  flight?: { from: ScreenRect; colour: PagePreview } | null;
  onFlightEnd?: () => void;
  alt: string;
}

/** One page in the review carousel */
export function PageSlide({
  preview,
  box,
  flight,
  onFlightEnd,
  alt,
}: PageSlideProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [landed, setLanded] = useState(!flight);
  // A flight plays once, from whatever it was when the slide mounted
  const initialFlight = useRef(flight);
  const onFlightEndRef = useRef(onFlightEnd);
  onFlightEndRef.current = onFlightEnd;

  const base = flight ? flight.colour : preview;
  const size = base ? containSize({ page: base, box }) : null;

  // FLIP: start the page where it sat in the camera view, then animate home
  useEffect(() => {
    const element = pageRef.current;
    const from = initialFlight.current?.from;
    if (!from || !element) return;
    initialFlight.current = null;
    const finish = () => {
      setLanded(true);
      onFlightEndRef.current?.();
    };
    const to = element.getBoundingClientRect();
    if (!to.width || typeof element.animate !== "function") {
      finish();
      return;
    }
    const dx = from.x + from.width / 2 - (to.x + to.width / 2);
    const dy = from.y + from.height / 2 - (to.y + to.height / 2);
    const scale = Math.max(from.width / to.width, from.height / to.height);
    const animation = element.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transform: "none" },
      ],
      { duration: FLIGHT_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    animation.finished.then(finish, finish);
  }, []);

  if (!base || !size) {
    return <IsLoading label="Preparing page" className="text-white/70" />;
  }

  return (
    <div
      ref={pageRef}
      className="relative shadow-2xl"
      style={{ width: size.width, height: size.height }}
    >
      {/* biome-ignore lint/performance/noImgElement: blob: URL of a scan rendered in the browser; next/image can't load it */}
      <img
        src={base.url}
        alt={alt}
        className="absolute inset-0 size-full"
        draggable={false}
      />
      {flight && preview ? (
        // biome-ignore lint/performance/noImgElement: blob: URL of a scan rendered in the browser; next/image can't load it
        <img
          src={preview.url}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-500",
            landed ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}
