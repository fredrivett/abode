"use client";

import { Check, Copy, ExternalLink, Pencil, Unlink } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useModifierKeySymbol } from "@/hooks/use-modifier-key-symbol";
import {
  formatLinkForDisplay,
  getOpenableHref,
  normalizeLinkInput,
} from "@/lib/link-href";
import { cn } from "@/lib/utils";

const COPIED_RESET_MS = 1500;

type NoteLinkMenuPanelProps = {
  /** The link's stored href (may be unsafe — it's only opened if openable) */
  href: string;
  onOpen: () => void;
  /** Resolves whether the copy succeeded */
  onCopy: () => Promise<boolean>;
  /** Called with the normalised href when an edit is saved */
  onSave: (href: string) => void;
  onRemove: () => void;
  /** Called when an edit is abandoned with Escape (return focus to the note) */
  onCancelEdit?: () => void;
  /** Called when focus leaves the edit form for somewhere else (the edit is dropped) */
  onEditBlur?: (next: EventTarget | null) => void;
  /** Start in the edit form (stories) */
  defaultEditing?: boolean;
  className?: string;
};

/**
 * The card shown under a link in an editable note: the URL plus Open, Copy,
 * Edit and Remove. Clicking a link only places the caret, so this is how a
 * link is opened on touch (desktop can also ⌘/Ctrl-click).
 */
export function NoteLinkMenuPanel({
  href,
  onOpen,
  onCopy,
  onSave,
  onRemove,
  onCancelEdit,
  onEditBlur,
  defaultEditing = false,
  className,
}: NoteLinkMenuPanelProps) {
  const [editing, setEditing] = useState(defaultEditing);

  return (
    <div
      className={cn(
        "flex max-w-[min(26rem,calc(100vw-2rem))] items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
    >
      {editing ? (
        <NoteLinkEditForm
          href={href}
          onSave={(next) => {
            setEditing(false);
            onSave(next);
          }}
          onCancel={() => {
            setEditing(false);
            onCancelEdit?.();
          }}
          onBlurOut={(next) => {
            setEditing(false);
            onEditBlur?.(next);
          }}
        />
      ) : (
        <NoteLinkActions
          href={href}
          onOpen={onOpen}
          onCopy={onCopy}
          onEdit={() => setEditing(true)}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}

function NoteLinkActions({
  href,
  onOpen,
  onCopy,
  onEdit,
  onRemove,
}: {
  href: string;
  onOpen: () => void;
  onCopy: () => Promise<boolean>;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const modifierKeySymbol = useModifierKeySymbol();
  const [copied, setCopied] = useState(false);
  const openable = getOpenableHref(href) !== null;
  const label = formatLinkForDisplay(href) || "No address";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <>
      {openable ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(event) => {
            event.preventDefault();
            onOpen();
          }}
          // Middle-click too, so every open goes through the same safe,
          // tracked path
          onAuxClick={(event) => {
            if (event.button !== 1) return;
            event.preventDefault();
            onOpen();
          }}
          className="min-w-0 truncate px-2 text-primary text-sm underline-offset-2 hover:underline"
        >
          {label}
        </a>
      ) : (
        <span className="min-w-0 truncate px-2 text-muted-foreground text-sm">
          {label}
        </span>
      )}
      <div aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      <ActionButton
        label="Open link"
        hint={
          <KbdGroup>
            <Kbd>{modifierKeySymbol}</Kbd>
            <Kbd>Click</Kbd>
          </KbdGroup>
        }
        onClick={onOpen}
        disabled={!openable}
      >
        <ExternalLink />
      </ActionButton>
      <ActionButton
        label={copied ? "Copied" : "Copy link"}
        onClick={async () => setCopied(await onCopy())}
      >
        {copied ? <Check /> : <Copy />}
      </ActionButton>
      <ActionButton label="Edit link" onClick={onEdit}>
        <Pencil />
      </ActionButton>
      <ActionButton label="Remove link" onClick={onRemove}>
        <Unlink />
      </ActionButton>
    </>
  );
}

function ActionButton({
  label,
  hint,
  onClick,
  disabled,
  children,
}: {
  label: string;
  hint?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className="shrink-0"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <span className="flex items-center gap-2">
          {label}
          {hint && <span className="hidden md:inline-flex">{hint}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function NoteLinkEditForm({
  href,
  onSave,
  onCancel,
  onBlurOut,
}: {
  href: string;
  onSave: (href: string) => void;
  onCancel: () => void;
  onBlurOut: (next: EventTarget | null) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const [draft, setDraft] = useState(href);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Escape cancels the edit only. Caught on window in the capture phase
  // because the item dialog's dismiss listener sits on document (also capture)
  // and would otherwise close the whole note
  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!(event.target instanceof Node)) return;
      if (!formRef.current?.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      onCancelRef.current();
    };
    window.addEventListener("keydown", handleEscape, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleEscape, { capture: true });
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next = normalizeLinkInput(draft);
    if (!next) {
      setInvalid(true);
      return;
    }
    onSave(next);
  };

  // Keep Enter inside the form: the composer saves the note on ⌘/Ctrl+Enter
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") event.stopPropagation();
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        onBlurOut(next);
      }}
      className="flex w-[min(22rem,calc(100vw-3rem))] items-center gap-1"
    >
      <Input
        ref={inputRef}
        type="text"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label="Link address"
        aria-invalid={invalid || undefined}
        placeholder="Paste or type a link"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        className="h-8"
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label="Save link"
      >
        <Check />
      </Button>
    </form>
  );
}
