"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, Clock, Mail, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Invite = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

type InviteSettingsProps = {
  invitesRemaining: number;
  initialInvites: Invite[];
};

export function InviteSettings({
  invitesRemaining: initialRemaining,
  initialInvites,
}: InviteSettingsProps) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [invitesRemaining, setInvitesRemaining] = useState(initialRemaining);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || invitesRemaining <= 0) return;

    setIsSending(true);

    try {
      const response = await fetch("/api/v1/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to send invite");
        return;
      }

      toast.success(`Invite sent to ${email}`);
      setEmail("");

      // Use the computed invitesRemaining from the API response
      setInvitesRemaining(data.invitesRemaining);

      // Check if this was a re-send (email already in list) or new invite
      const existingInviteIndex = invites.findIndex(
        (inv) => inv.email.toLowerCase() === data.invite.email.toLowerCase(),
      );

      if (existingInviteIndex >= 0) {
        // Re-send: update the existing invite in the list
        setInvites((prev) =>
          prev.map((inv, idx) =>
            idx === existingInviteIndex
              ? {
                  ...inv,
                  status: "pending" as const,
                  expiresAt: data.invite.expiresAt,
                }
              : inv,
          ),
        );
      } else {
        // New invite: add to the list
        setInvites((prev) => [
          {
            id: data.invite.id,
            email: data.invite.email,
            status: "pending",
            createdAt: new Date().toISOString(),
            expiresAt: data.invite.expiresAt,
            acceptedAt: null,
          },
          ...prev,
        ]);
      }
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="rounded-xl border p-6">
      <h3 className="text-lg font-semibold">Invites</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Invite friends to join abode. You have{" "}
        <span className="font-medium text-foreground">{invitesRemaining}</span>{" "}
        invite{invitesRemaining !== 1 ? "s" : ""} remaining.
      </p>

      {invitesRemaining > 0 ? (
        <form onSubmit={handleSendInvite} className="mt-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="invite-email" className="sr-only">
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                required
                disabled={isSending}
              />
            </div>
            <Button type="submit" disabled={isSending || !email.trim()}>
              {isSending ? "Sending..." : "Send invite"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          You've used all your invites. Thanks for spreading the word!
        </p>
      )}

      {invites.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            Sent invites
          </h4>
          <div className="space-y-2">
            {invites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function InviteRow({ invite }: { invite: Invite }) {
  const statusIcon = {
    pending: <Clock className="size-4 text-yellow-500" />,
    accepted: <Check className="size-4 text-green-500" />,
    expired: <X className="size-4 text-muted-foreground" />,
  };

  const getStatusText = () => {
    if (invite.status === "accepted" && invite.acceptedAt) {
      return `joined ${formatDistanceToNow(new Date(invite.acceptedAt), { addSuffix: true })}`;
    }
    if (invite.status === "pending") {
      return `expires ${formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}`;
    }
    return "expired";
  };

  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <span className="text-sm">{invite.email}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {statusIcon[invite.status]}
        <span>{getStatusText()}</span>
      </div>
    </div>
  );
}
