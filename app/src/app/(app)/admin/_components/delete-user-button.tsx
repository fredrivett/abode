"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserDeletionStats } from "@/components/user-deletion-stats";
import { deleteUserAsAdmin } from "../(protected)/actions";

type UserStats = {
  itemCount: number;
  roomCount: number;
};

type DeleteUserButtonProps = {
  userId: string;
  userEmail: string;
};

export function DeleteUserButton({ userId, userEmail }: DeleteUserButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  // Fetch stats when dialog opens
  useEffect(() => {
    if (isOpen && !stats) {
      setIsLoadingStats(true);
      fetch(`/api/v1/admin/users/${userId}`)
        .then((res) => res.json())
        .then((data) => {
          setStats({
            itemCount: data.user?.itemCount ?? 0,
            roomCount: data.user?.roomCount ?? 0,
          });
        })
        .catch(() => {
          // Silently fail, we'll show generic message
        })
        .finally(() => {
          setIsLoadingStats(false);
        });
    }
  }, [isOpen, stats, userId]);

  const handleDelete = async () => {
    // Validate email confirmation
    if (emailConfirmation !== userEmail) {
      toast.error("Email address does not match");
      return;
    }

    startTransition(async () => {
      const result = await deleteUserAsAdmin(userId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("User deleted successfully");
        setIsOpen(false);
      }
    });
  };

  // Reset email confirmation when dialog closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEmailConfirmation("");
    }
  };

  const emailMatches = emailConfirmation === userEmail;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4" />
          Permanently Delete User
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete {userEmail}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                This action is permanent and cannot be undone. All user data
                will be deleted immediately.
              </p>

              {stats && (
                <UserDeletionStats
                  itemCount={stats.itemCount}
                  roomCount={stats.roomCount}
                  isLoading={isLoadingStats}
                />
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-4 space-y-2">
          <Label htmlFor="email-confirmation">
            Type <Badge variant="secondary">{userEmail}</Badge> to confirm
          </Label>
          <input
            id="email-confirmation"
            type="text"
            value={emailConfirmation}
            onChange={(e) => setEmailConfirmation(e.target.value)}
            placeholder="Enter email address"
            autoComplete="off"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending || !emailMatches}
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
          >
            <Trash2 className="size-4" />
            Permanently Delete User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
