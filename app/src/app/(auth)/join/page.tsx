import type { Metadata } from "next";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { validateInviteToken } from "@/lib/invites";
import { getSaveableSharedItem } from "@/lib/invites/share-invite";
import {
  InviteAlreadyUsedError,
  InviteExpiredError,
  InviteInvalidError,
} from "./invite-errors";
import { JoinForm } from "./join-form";
import { JoinWithoutToken } from "./join-without-token";

export const metadata: Metadata = { title: "Join | abode" };

type PageProps = {
  searchParams: Promise<{ token?: string; save?: string }>;
};

export default async function JoinPage({ searchParams }: PageProps) {
  const { token, save } = await searchParams;

  // No token: explain invite links, take a pasted one, or join the waitlist
  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm space-y-6 px-4">
          <JoinWithoutToken />
        </div>
      </div>
    );
  }

  // Validate the token
  const result = await validateInviteToken(token);

  // Invalid token (doesn't exist)
  if (!result.valid && result.code === "INVALID_TOKEN") {
    return <InviteInvalidError />;
  }

  // Expired token
  if (!result.valid && result.code === "EXPIRED") {
    return <InviteExpiredError invite={result.invite} />;
  }

  // Already accepted (user already signed up with this invite)
  if (!result.valid && result.code === "ALREADY_ACCEPTED") {
    return <InviteAlreadyUsedError invite={result.invite} />;
  }

  // Guard for TypeScript - at this point result must be valid
  if (!result.valid) {
    return <InviteInvalidError />;
  }

  // Valid token - show signup form
  const { invite } = result;
  const showInviterBanner = invite.origin === "user" && invite.inviter;
  // Joining from a shared item: it's saved to the new abode after signup
  const saveItem = save ? await getSaveableSharedItem(save) : null;

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        {showInviterBanner && invite.inviter && (
          <div className="rounded-lg bg-gray-100 p-4 text-center dark:bg-gray-800">
            <p className="flex flex-wrap items-center justify-center gap-2 text-gray-600 text-sm dark:text-gray-300">
              you&apos;ve been invited by{" "}
              <span className="flex items-center gap-1">
                {invite.inviter.avatarUrl && (
                  <UserAvatar
                    avatarUrl={invite.inviter.avatarUrl}
                    firstName={invite.inviter.firstName}
                    lastName={invite.inviter.lastName}
                    username={invite.inviter.username}
                    className="size-6"
                  />
                )}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  @{invite.inviter.username}
                </span>
              </span>
            </p>
          </div>
        )}

        {saveItem && (
          <p className="text-center text-gray-500 text-sm dark:text-gray-400">
            we&apos;ll save{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {saveItem.title ?? "this"}
            </span>{" "}
            to your abode once you&apos;re in
          </p>
        )}

        <JoinForm
          token={token}
          email={invite.email}
          inviteOrigin={invite.origin}
          saveItemId={saveItem?.id ?? null}
        />
      </div>
    </div>
  );
}
