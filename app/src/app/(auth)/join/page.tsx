import { UserAvatar } from "@/components/avatar/user-avatar";
import { validateInviteToken } from "@/lib/invites";
import { EnterCodeForm } from "./enter-code-form";
import { JoinForm } from "./join-form";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function JoinPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  // No token provided - show "enter invite code" form
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-6 px-4">
          <EnterCodeForm />
        </div>
      </div>
    );
  }

  // Validate the token
  const result = await validateInviteToken(token);

  // Invalid or expired token
  if (!result.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-6 px-4">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {result.code === "EXPIRED" ? "invite expired" : "invalid invite"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {result.code === "EXPIRED"
                ? "this invite link has expired. ask your friend for a new one."
                : "this invite link is invalid or has already been used."}
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="/"
              className="flex h-10 w-full items-center justify-center rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              join the waitlist
            </a>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              or{" "}
              <a
                href="/join"
                className="font-medium text-gray-900 hover:underline dark:text-gray-100"
              >
                enter a different code
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Valid token - show signup form
  const { invite } = result;
  const showInviterBanner = invite.origin === "user" && invite.inviter;

  return (
    <div className="flex min-h-screen items-center justify-center">
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
