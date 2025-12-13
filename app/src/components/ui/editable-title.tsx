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

import { cn } from "@/lib/utils";

const SIZE_STYLES: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

export interface EditableTitleProps {
  value: string;
  onSubmit?: (value: string) => void | Promise<void>;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  disabled?: boolean;
  isSaving?: boolean;
  inputClassName?: string;
}

export function EditableTitle({
  value,
  onSubmit,
  size = "lg",
  className,
  disabled = false,
  isSaving = false,
  inputClassName,
}: EditableTitleProps) {
  const canEdit = Boolean(onSubmit) && !disabled;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const measurementRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number>();

  const textClasses = useMemo(
    () =>
      cn(
        "font-semibold leading-tight",
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

  // Measure width for input sizing
  useLayoutEffect(() => {
    if (!canEdit || !measurementRef.current) return;
    const width = measurementRef.current.offsetWidth;
    if (width > 0) {
      setInputWidth(Math.max(width + 4, 32));
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
    return <h2 className={textClasses}>{value}</h2>;
  }

  const showIcon = !isEditing && (isSaving || pending);

  return (
    <div
      className={cn(
        "group relative inline-block -mx-2.5 -my-1.5",
        isEditing || isSaving || pending ? "mr-0" : "hover:mr-0",
      )}
    >
      {/* Hidden measurement span */}
      <span
        ref={measurementRef}
        className={cn(
          textClasses,
          "pointer-events-none absolute opacity-0 whitespace-pre -z-10",
        )}
        aria-hidden="true"
      >
        {(draft || "").replace(/\s/g, "\u00a0") || "\u00a0"}
      </span>

      {/* Always-rendered input with padding for icons */}
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={handleCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void handleCommit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            handleCancel();
          }
        }}
        disabled={disabled || isSaving || pending}
        size={Math.max(draft.length, 1)}
        style={{ width: inputWidth ? `${inputWidth}px` : undefined }}
        className={cn(
          textClasses,
          "box-content border-none outline-none cursor-text transition-[bg,padding] px-2.5 py-1.5",
          isEditing
            ? "bg-gray-100 dark:bg-gray-800 pr-2.5"
            : "bg-transparent hover:bg-gray-100 hover:dark:bg-gray-800",
          (showIcon || !isEditing) && "hover:pr-9",
          (isSaving || pending) && "pr-9",
          inputClassName,
        )}
      />

      {/* Absolutely positioned icons */}
      {isSaving || pending ? (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
      ) : (
        <PenLine
          className={cn(
            "absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none transition-opacity duration-150",
            isEditing ? "opacity-0" : "opacity-0 group-hover:opacity-100",
          )}
        />
      )}
    </div>
  );
}
