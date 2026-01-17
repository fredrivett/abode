import { UserAvatar } from "@/components/avatar/user-avatar";
import { validateInviteToken } from "@/lib/invites";
import { EnterCodeForm } from "./enter-code-form";
import {
  InviteAlreadyUsedError,
  InviteExpiredError,
  InviteInvalidError,
} from "./invite-errors";
import { JoinForm } from "./join-form";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function JoinPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  // No token provided - show "enter invite code" form
  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm space-y-6 px-4">
          <EnterCodeForm />
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

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        {showInviterBanner && invite.inviter && (
          <div className="rounded-lg bg-gray-100 p-4 text-center dark:bg-gray-800">
            <p className="flex items-center justify-center flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-300">
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

        <JoinForm
          token={token}
          email={invite.email}
          inviteOrigin={invite.origin}
        />
      </div>
    </div>
  );
}
