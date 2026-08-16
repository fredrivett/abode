import { DoorOpen, Globe, UserPlus, Users } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RoomCard } from "@/components/rooms/room-card";
import { ProfileViewTracker } from "@/components/tracking/profile-view-tracker";
import { ProfileTag } from "@/components/user/profile-tag";
import db from "@/lib/db";
import { formatMemberNumber } from "@/lib/format-member-number";
import { getDisplayName } from "@/lib/get-display-name";
import { getHostname } from "@/lib/url-utils";

type Props = {
  params: Promise<{ username: string }>;
};

// Parse and validate the username from the route param
// Returns the username without @ prefix, or null if invalid (missing @ prefix)
function parseUsername(rawUsername: string): string | null {
  // Next.js passes URL-encoded params, so %40 needs to be decoded to @
  const decoded = decodeURIComponent(rawUsername);
  if (!decoded.startsWith("@")) {
    return null;
  }
  return decoded.slice(1);
}

const getUser = cache(async (username: string) => {
  return db.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      website: true,
      avatarUrl: true,
      createdAt: true,
      memberNumber: true,
      showInvitedBy: true,
      showInvited: true,
      referredBy: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      referrals: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
});

const getPublicRooms = cache(async (userId: string) => {
  return db.room.findMany({
    where: {
      userId,
      visibility: "public",
      slug: { not: null },
    },
    select: {
      id: true,
      name: true,
      emoji: true,
      slug: true,
      type: true,
      _count: {
        select: { roomItems: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
});

export async function generateMetadata({ params }: Props) {
  const { username: rawUsername } = await params;
  const username = parseUsername(rawUsername);

  if (!username) {
    return { title: "User not found" };
  }

  const user = await getUser(username);

  if (!user) {
    return { title: "User not found" };
  }

  const displayName = getDisplayName(user);

  return {
    title: `${displayName} | abode`,
    description: `${displayName}'s profile on abode`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username: rawUsername } = await params;
  const username = parseUsername(rawUsername);

  // Only match URLs with @ prefix (e.g., /@fred, not /fred)
  if (!username) {
    notFound();
  }

  const user = await getUser(username);

  if (!user) {
    notFound();
  }

  const publicRooms = await getPublicRooms(user.id);
  const displayName = getDisplayName(user);
  const showUsername = user.firstName !== null;

  return (
    <>
      <ProfileViewTracker
        profileUserId={user.id}
        profileUsername={user.username}
        publicRoomCount={publicRooms.length}
        referralCount={user.referrals.length}
      />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
          <div className="flex flex-col items-center text-center">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={displayName}
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted font-medium text-3xl text-muted-foreground">
                {(
                  user.firstName?.[0] ||
                  user.username?.[0] ||
                  "?"
                ).toUpperCase()}
              </div>
            )}

            <h1 className="mt-6 font-semibold font-serif text-3xl tracking-tight">
              {displayName}
            </h1>

            {showUsername && (
              <p className="mt-1 text-muted-foreground">@{user.username}</p>
            )}

            {user.website && (
              <a
                href={user.website}
                target="_blank"
                rel="me noopener noreferrer nofollow"
                className="mt-4 inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
              >
                <Globe className="size-4" />
                {getHostname(user.website)}
              </a>
            )}

            <p className="mt-4 text-muted-foreground text-sm">
              {user.memberNumber &&
                `Member #${formatMemberNumber(user.memberNumber)}, since `}
              {!user.memberNumber && "Member since "}
              {new Intl.DateTimeFormat("en-US", {
                month: "long",
                year: "numeric",
              }).format(user.createdAt)}
            </p>

            {user.showInvitedBy && user.referredBy && (
              <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
                <UserPlus className="size-4" />
                <span>Invited by</span>
                <ProfileTag user={user.referredBy} />
              </div>
            )}
          </div>

          {user.showInvited && user.referrals.length > 0 && (
            <div className="mt-12">
              <h2 className="flex items-center justify-center gap-2 font-semibold font-serif text-xl">
                <Users className="size-5 text-muted-foreground" />
                Invited
              </h2>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {user.referrals.map((referral) => (
                  <ProfileTag key={referral.id} user={referral} />
                ))}
              </div>
            </div>
          )}

          {publicRooms.length > 0 && (
            <div className="mt-12">
              <h2 className="flex items-center justify-center gap-2 font-semibold font-serif text-xl">
                <DoorOpen className="size-5 text-muted-foreground" />
                Rooms
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {publicRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    href={`/@${user.username}/${room.slug}`}
                    name={room.name}
                    emoji={room.emoji}
                    itemCount={room._count.roomItems}
                    type={room.type}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
