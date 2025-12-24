import Link from "next/link";

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

const errorMessages: Record<string, { title: string; description: string }> = {
  missing_params: {
    title: "invalid link",
    description: "this verification link is invalid or incomplete.",
  },
  verification_failed: {
    title: "verification failed",
    description: "we couldn't verify your email. the link may have expired.",
  },
  no_user: {
    title: "something went wrong",
    description: "we couldn't find your account after verification.",
  },
  INVALID_TOKEN: {
    title: "invalid invite",
    description: "the invite token is invalid or has been used.",
  },
  INVITE_USED: {
    title: "invite already used",
    description: "this invite has already been used by another user.",
  },
  INVITE_EXPIRED: {
    title: "invite expired",
    description: "this invite has expired. please request a new one.",
  },
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const error = errorMessages[reason ?? ""] ?? {
    title: "something went wrong",
    description: "an unexpected error occurred during authentication.",
  };

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {error.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {error.description}
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="flex h-10 w-full items-center justify-center rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            go to login
          </Link>
          <p className="text-sm text-gray-500">
            or{" "}
            <Link
              href="/join"
              className="font-medium text-gray-900 hover:underline dark:text-gray-100"
            >
              try a different invite code
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
