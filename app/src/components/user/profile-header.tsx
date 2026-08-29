import { CalendarDays, Globe, Hash, UserPlus, Users } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ProfileTag } from "@/components/user/profile-tag";
import { formatInvitedCount } from "@/lib/format-invited-count";
import { formatMemberNumber } from "@/lib/format-member-number";
import { getDisplayName } from "@/lib/get-display-name";
import { linkifyBio } from "@/lib/linkify-bio";
import { getHostname } from "@/lib/url-utils";

type InviterUser = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type ProfileHeaderProps = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  website: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  memberNumber: number | null;
  // Whether to show who invited this user
  showInvitedBy: boolean;
  referredBy: InviterUser | null;
  // When false, the invited count renders inline here instead of the split-out
  // InvitedSection
  showInvited: boolean;
  referralCount: number;
};

export function ProfileHeader({
  username,
  firstName,
  lastName,
  website,
  bio,
  avatarUrl,
  createdAt,
  memberNumber,
  showInvitedBy,
  referredBy,
  showInvited,
  referralCount,
}: ProfileHeaderProps) {
  const displayName = getDisplayName({ firstName, lastName, username });
  const showUsername = firstName !== null;

  return (
    <div className="flex flex-col items-center text-center">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted font-medium text-3xl text-muted-foreground">
          {(firstName?.[0] || username?.[0] || "?").toUpperCase()}
        </div>
      )}

      <h1 className="mt-6 font-semibold font-serif text-3xl tracking-tight">
        {displayName}
      </h1>

      {showUsername && (
        <p className="mt-1 text-muted-foreground">@{username}</p>
      )}

      {bio && (
        <p className="mt-4 max-w-md whitespace-pre-wrap text-pretty text-muted-foreground">
          {linkifyBio(bio)}
        </p>
      )}

      {website && (
        <Badge
          asChild
          variant="secondary"
          className="mt-4 cursor-pointer text-sm"
        >
          <a
            href={website}
            target="_blank"
            rel="me noopener noreferrer nofollow"
          >
            <Globe />
            {getHostname(website)}
          </a>
        </Badge>
      )}

      <div className="mt-4 flex flex-col items-center gap-2 text-muted-foreground text-sm">
        {memberNumber && (
          <div className="flex items-center gap-2">
            <Hash className="size-4" />
            <span>Member #{formatMemberNumber(memberNumber)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          <span>
            Joined{" "}
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
            }).format(createdAt)}
          </span>
        </div>
        {showInvitedBy && referredBy && (
          <div className="flex items-center gap-2">
            <UserPlus className="size-4" />
            <span>Invited by</span>
            <ProfileTag user={referredBy} />
          </div>
        )}
        {!showInvited && referralCount > 0 && (
          <div className="flex items-center gap-2">
            <Users className="size-4" />
            <span>Invited {formatInvitedCount(referralCount)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
