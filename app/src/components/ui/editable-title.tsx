"use client";

import { Loader2, PenLine } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { matchesShortcut } from "@/lib/keyboard";
import { cn } from "@/lib/utils";

const SIZE_STYLES: Record<"sm" | "md" | "lg" | "xl" | "2xl", string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
  "2xl": "text-3xl",
};

export interface EditableTitleProps {
  value: string;
  onSubmit?: (value: string) => void | Promise<void>;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  disabled?: boolean;
  isSaving?: boolean;
  inputClassName?: string;
  /** Allow multi-line text with wrapping */
  multiline?: boolean;
}

export function EditableTitle({
  value,
  onSubmit,
  size = "lg",
  className,
  disabled = false,
  isSaving = false,
  inputClassName,
  multiline = false,
}: EditableTitleProps) {
  const canEdit = Boolean(onSubmit) && !disabled;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measurementRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number>();

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  // Resize on draft change for multiline
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft is intentionally included to resize when text changes
  useLayoutEffect(() => {
    if (multiline) {
      resizeTextarea();
    }
  }, [multiline, draft, resizeTextarea]);

  const textClasses = useMemo(
    () =>
      cn(
        "font-serif font-semibold leading-tight",
        SIZE_STYLES[size],
        disabled ? "cursor-default opacity-50" : null,
        className,
      ),
    [className, disabled, size],
  );

  // Sync draft with value when not editing
  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [isEditing, value]);

  // Measure width for input sizing (content-box means we measure just the text, padding is added on top)
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft is intentionally included to remeasure when text changes
  useLayoutEffect(() => {
    if (!canEdit || !measurementRef.current) return;
    const width = measurementRef.current.offsetWidth;
    if (width > 0) {
      setInputWidth(Math.max(width, 32));
    }
  }, [canEdit, draft]);

  const handleCommit = useCallback(async () => {
    if (!canEdit) {
      setIsEditing(false);
      setDraft(value);
      return;
    }

    const nextValue = draft.trim();

    if (!nextValue || nextValue === value.trim()) {
      setIsEditing(false);
      setDraft(value);
      return;
    }

    if (pending || isSaving) return;

    try {
      setPending(true);
      await onSubmit?.(nextValue);
    } finally {
      setPending(false);
      setIsEditing(false);
    }
  }, [canEdit, draft, isSaving, onSubmit, pending, value]);

  const handleCancel = useCallback(() => {
    setDraft(value);
    setIsEditing(false);
  }, [value]);

  if (!canEdit) {
    return (
      <h2 className={cn(textClasses, multiline && "whitespace-pre-wrap")}>
        {value}
      </h2>
    );
  }

  const sharedInputClasses = cn(
    textClasses,
    "border-none outline-none cursor-text transition-[background,padding,max-width] px-2.5 py-1.5",
    isEditing
      ? "bg-gray-100 dark:bg-gray-800 pr-2.5"
      : "bg-transparent hover:bg-gray-100 hover:dark:bg-gray-800 hover:pr-9",
    (isSaving || pending) && "pr-9",
    inputClassName,
  );

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // For multiline, Enter creates a new line (default behavior), Cmd/Ctrl+Enter commits
    if (multiline) {
      if (matchesShortcut(event, { key: "Enter", modifier: true })) {
        event.preventDefault();
        void handleCommit();
      }
    } else {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleCommit();
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  };

  // Multiline version with textarea
  if (multiline) {
    return (
      <div
        className={cn(
          "group -mx-2.5 -my-1.5 relative w-full",
          isEditing || isSaving || pending ? "mr-0" : "hover:mr-0",
        )}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSaving || pending}
          rows={1}
          className={cn(
            sharedInputClasses,
            "w-full resize-none overflow-hidden",
            !isEditing &&
              "max-w-[calc(100%-26px)] hover:max-w-[calc(100%-46px)]",
            (isSaving || pending) && "max-w-[calc(100%-46px)]",
          )}
        />

        {/* Absolutely positioned icons - top aligned for multiline */}
        {isSaving || pending ? (
          <Loader2 className="absolute top-3.5 right-2.5 size-4 animate-spin text-muted-foreground" />
        ) : (
          <PenLine
            className={cn(
              "pointer-events-none absolute top-3.5 right-2.5 size-4 text-muted-foreground transition-opacity duration-150",
              isEditing ? "opacity-0" : "opacity-0 group-hover:opacity-100",
            )}
          />
        )}
      </div>
    );
  }

  // Single-line version with input
  return (
    <div
      className={cn(
        "group -mx-2.5 -my-1.5 relative inline-block max-w-full",
        isEditing || isSaving || pending ? "mr-0" : "hover:mr-0",
      )}
    >
      {/* Hidden measurement span - no padding since input uses content-box */}
      <span
        ref={measurementRef}
        className={cn(
          textClasses,
          "-z-10 pointer-events-none absolute whitespace-pre opacity-0",
        )}
        aria-hidden="true"
      >
        {(draft || "").replace(/\s/g, "\u00a0") || "\u00a0"}
      </span>

      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSaving || pending}
        size={Math.max(draft.length, 1)}
        style={{ width: inputWidth }}
        className={cn(
          sharedInputClasses,
          // max-width accounts for padding: 100% - px-2.5 (10px) - pr-2.5 or pr-9 (10px or 36px)
          "box-content max-w-[calc(100%-20px)]",
          !isEditing && "hover:max-w-[calc(100%-46px)]",
          (isSaving || pending) && "max-w-[calc(100%-46px)]",
        )}
      />

      {/* Absolutely positioned icons */}
      {isSaving || pending ? (
        <Loader2 className="-translate-y-1/2 absolute top-1/2 right-2.5 size-4 animate-spin text-muted-foreground" />
      ) : (
        <PenLine
          className={cn(
            "-translate-y-1/2 pointer-events-none absolute top-1/2 right-2.5 size-4 text-muted-foreground transition-opacity duration-150",
            isEditing ? "opacity-0" : "opacity-0 group-hover:opacity-100",
          )}
        />
      )}
    </div>
  );
}
