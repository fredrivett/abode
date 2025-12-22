"use client";

import { DoorOpen, Image, User } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "../actions";

type UserStats = {
  itemCount: number;
  roomCount: number;
};

export function DeleteAccountSettings() {
  const [state, action, isPending] = useActionState(deleteAccount, {});
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Fetch stats when dialog opens
  useEffect(() => {
    if (isOpen && !stats) {
      setIsLoadingStats(true);
      fetch("/api/v1/user/stats")
        .then((res) => res.json())
        .then((data) => {
          setStats(data);
        })
        .catch(() => {
          // Silently fail, we'll show generic message
        })
        .finally(() => {
          setIsLoadingStats(false);
        });
    }
  }, [isOpen, stats]);

  // Handle errors
  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  // Reset password when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPassword("");
    }
  }, [isOpen]);

  return (
    <section className="rounded-xl border border-destructive/50 p-6">
      <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently delete your account and all associated data.
      </p>

      <div className="mt-4">
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete Account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>
                    This action is permanent and cannot be undone. All your data
                    will be deleted immediately.
                  </p>

                  {isLoadingStats ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : stats ? (
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-sm font-medium text-foreground">
                        This will permanently delete:
                      </p>
                      <div className="mt-3 space-y-2 pl-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Image className="size-4 text-muted-foreground" />
                          <span>
                            {stats.itemCount} item
                            {stats.itemCount !== 1 && "s"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <DoorOpen className="size-4 text-muted-foreground" />
                          <span>
                            {stats.roomCount} room
                            {stats.roomCount !== 1 && "s"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="size-4 text-muted-foreground" />
                          <span>Your profile and account data</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <form action={action} className="mt-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-password">
                  Enter your password to confirm
                </Label>
                <input
                  id="delete-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  type="submit"
                  variant="destructive"
                  disabled={isPending || !password}
                >
                  {isPending ? "Deleting..." : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
