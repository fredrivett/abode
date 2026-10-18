"use client";

import { ShieldAlert } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogOrDrawer,
  DialogOrDrawerBody,
  DialogOrDrawerContent,
  DialogOrDrawerDescription,
  DialogOrDrawerFooter,
  DialogOrDrawerHeader,
  DialogOrDrawerTitle,
} from "@/components/ui/dialog-or-drawer";
import { Input } from "@/components/ui/input";
import { IsLoading } from "@/components/ui/is-loading";
import { Label } from "@/components/ui/label";
import { ApiClientError, api } from "@/lib/api-client";

type SensitiveUnlockDialogProps = {
  open: boolean;
  /** Called once the password is accepted and sensitive items are unlocked. */
  onUnlocked: () => void;
  onCancel: () => void;
  /** Overrides the network call (stories/tests). Resolves on success. */
  unlock?: (password: string) => Promise<unknown>;
};

const unlockSensitiveItems = (password: string) =>
  api.post("/api/v1/sensitive-unlock", { password });

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "incorrect_password") return "Incorrect password";
    if (error.status === 429) return error.message;
  }
  return "Couldn't check your password. Try again.";
}

/**
 * Password prompt shown before a sensitive item opens. A correct password
 * unlocks sensitive items for a couple of minutes (server-side cookie).
 */
export function SensitiveUnlockDialog({
  open,
  onUnlocked,
  onCancel,
  unlock = unlockSensitiveItems,
}: SensitiveUnlockDialogProps) {
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  // A check that resolves after the prompt was cancelled or closed must not
  // go on to open the item
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const cancel = () => {
    activeRef.current = false;
    onCancel();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) return;
    setIsChecking(true);
    setError(null);
    try {
      await unlock(password);
      if (!activeRef.current) return;
      setPassword("");
      onUnlocked();
    } catch (unlockError) {
      if (activeRef.current) setError(errorMessage(unlockError));
    } finally {
      if (activeRef.current) setIsChecking(false);
    }
  };

  return (
    <DialogOrDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) cancel();
      }}
    >
      <DialogOrDrawerContent className="sm:max-w-sm">
        {/* The content's flex gap spaces its direct children; keep it inside the form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogOrDrawerHeader>
            <DialogOrDrawerTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-muted-foreground" />
              Sensitive item
            </DialogOrDrawerTitle>
            <DialogOrDrawerDescription>
              Enter your password to open it.
            </DialogOrDrawerDescription>
          </DialogOrDrawerHeader>

          <DialogOrDrawerBody className="space-y-2">
            <Label htmlFor={passwordId} className="sr-only">
              Password
            </Label>
            <Input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              autoFocus
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error !== null}
              disabled={isChecking}
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </DialogOrDrawerBody>

          <DialogOrDrawerFooter>
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isChecking || !password}>
              {isChecking ? <IsLoading label="Checking" /> : "Open"}
            </Button>
          </DialogOrDrawerFooter>
        </form>
      </DialogOrDrawerContent>
    </DialogOrDrawer>
  );
}
