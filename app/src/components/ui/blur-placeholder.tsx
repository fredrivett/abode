import { cn } from "@/lib/utils";

type BlurPlaceholderProps = {
  /** Tiny crisp low-res data URL; blurred here in screen space (LQIP). */
  blurDataUrl: string;
  /** Whether the placeholder is shown (true until the real image has loaded). */
  visible: boolean;
  className?: string;
};

/**
 * LQIP blur layer. Sits on top of the real image and dissolves to reveal it once
 * loaded. The source is stored crisp and blurred here with a CSS filter; -inset-4
 * (16px) overscans ~2× the 8px blur radius so the filter's soft edge is clipped by
 * the parent instead of bleeding — the parent must be positioned + `overflow-hidden`.
 */
export function BlurPlaceholder({
  blurDataUrl,
  visible,
  className,
}: BlurPlaceholderProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "-inset-4 absolute bg-center bg-cover blur-[8px] transition-opacity duration-700",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ backgroundImage: `url("${blurDataUrl}")` }}
    />
  );
}
