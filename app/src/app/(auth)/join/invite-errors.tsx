import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { UserAvatar } from "@/components/avatar/user-avatar";
import type { InviteErrorContext } from "@/lib/invites";

type InviteErrorLayoutProps = {
  title: string;
  children: React.ReactNode;
};

function InviteErrorLayout({ title, children }: InviteErrorLayoutProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

type InviterBannerProps = {
  inviter: NonNullable<InviteErrorContext["inviter"]>;
};

function InviterBanner({ inviter }: InviterBannerProps) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <UserAvatar
        avatarUrl={inviter.avatarUrl}
        username={inviter.username}
        className="size-6"
      />
      <span className="text-sm text-gray-600 dark:text-gray-300">
        invited by{" "}
        <span className="font-medium text-gray-900 dark:text-gray-100">
          @{inviter.username}
        </span>
      </span>
    </div>
  );
}

type InviteExpiredErrorProps = {
  invite: InviteErrorContext;
};

export function InviteExpiredError({ invite }: InviteExpiredErrorProps) {
  const expiredAgo = formatDistanceToNow(invite.expiresAt, { addSuffix: true });

  const getMessage = () => {
    if (invite.origin === "user" && invite.inviter) {
      return `this invite expired ${expiredAgo}. ask @${invite.inviter.username} for a new one.`;
    }
    if (invite.origin === "waitlist") {
      return `your waitlist invite expired ${expiredAgo}. you can rejoin the waitlist or contact us.`;
    }
    // admin or unknown origin
    return `this invite expired ${expiredAgo}. please reach out to the team for a new one.`;
  };

  return (
    <InviteErrorLayout title="invite expired">
      {invite.origin === "user" && invite.inviter && (
        <InviterBanner inviter={invite.inviter} />
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400">{getMessage()}</p>

      <div className="space-y-3 pt-4">
        <Link
          href="/"
          className="flex h-10 w-full items-center justify-center rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          join the waitlist
        </Link>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          or{" "}
          <Link
            href="/join"
            className="font-medium text-gray-900 hover:underline dark:text-gray-100"
          >
            enter a different code
          </Link>
        </p>
      </div>
    </InviteErrorLayout>
  );
}

type InviteAlreadyUsedErrorProps = {
  invite: InviteErrorContext;
};

export function InviteAlreadyUsedError({ invite }: InviteAlreadyUsedErrorProps) {
  return (
    <InviteErrorLayout title="you've already joined">
      {invite.origin === "user" && invite.inviter && (
        <InviterBanner inviter={invite.inviter} />
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        this invite was used to create your account.
      </p>

      <div className="space-y-3 pt-4">
        <Link
          href="/login"
          className="flex h-10 w-full items-center justify-center rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          login
        </Link>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          or{" "}
          <Link
            href="/join"
            className="font-medium text-gray-900 hover:underline dark:text-gray-100"
          >
            enter a different code
          </Link>
        </p>
      </div>
    </InviteErrorLayout>
  );
}

export function InviteInvalidError() {
  return (
    <InviteErrorLayout title="invalid invite">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        this invite link is invalid or doesn&apos;t exist.
      </p>

      <div className="space-y-3 pt-4">
        <Link
          href="/"
          className="flex h-10 w-full items-center justify-center rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          join the waitlist
        </Link>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          or{" "}
          <Link
            href="/join"
            className="font-medium text-gray-900 hover:underline dark:text-gray-100"
          >
            enter a different code
          </Link>
        </p>
      </div>
    </InviteErrorLayout>
  );
}
