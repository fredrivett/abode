import Link from "next/link";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { getDisplayName } from "@/lib/get-display-name";
import { cn } from "@/lib/utils";

type ProfileTagUser = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type ProfileTagProps = {
  user: ProfileTagUser;
  size?: "default" | "sm";
  className?: string;
};

export function ProfileTag({ user, size = "default", className }: ProfileTagProps) {
  const displayName = getDisplayName(user);
  const showUsername = user.firstName !== null;

  const avatarSize = size === "sm" ? "size-6" : "size-8";
  const avatarFallbackSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <Link
      href={`/@${user.username}`}
      className={cn(
        "-m-2 flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-accent/50",
        className,
      )}
    >
      <UserAvatar
        avatarUrl={user.avatarUrl}
        firstName={user.firstName}
        lastName={user.lastName}
        username={user.username}
        className={avatarSize}
        fallbackClassName={avatarFallbackSize}
      />
      <span className="flex flex-col items-start leading-tight">
        <span className="font-medium text-sm">{displayName}</span>
        {showUsername && (
          <span className="text-muted-foreground text-xs">
            @{user.username}
          </span>
        )}
      </span>
    </Link>
  );
}
