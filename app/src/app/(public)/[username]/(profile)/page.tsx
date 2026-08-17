import { DoorOpen } from "lucide-react";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RoomCard } from "@/components/rooms/room-card";
import { ProfileViewTracker } from "@/components/tracking/profile-view-tracker";
import { InvitedSection } from "@/components/user/invited-section";
import { ProfileHeader } from "@/components/user/profile-header";
import db from "@/lib/db";
import { getDisplayName } from "@/lib/get-display-name";
import {
  deriveRoomThumbnails,
  ROOM_THUMBNAIL_LIMIT,
  roomThumbnailItemSelect,
  roomThumbnailItemWhere,
} from "@/lib/rooms/room-thumbnails";

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
      roomItems: {
        where: { item: roomThumbnailItemWhere },
        orderBy: { addedAt: "desc" },
        take: ROOM_THUMBNAIL_LIMIT,
        select: { item: { select: roomThumbnailItemSelect } },
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
          <ProfileHeader
            username={user.username}
            firstName={user.firstName}
            lastName={user.lastName}
            website={user.website}
            avatarUrl={user.avatarUrl}
            createdAt={user.createdAt}
            memberNumber={user.memberNumber}
            showInvitedBy={user.showInvitedBy}
            referredBy={user.referredBy}
            showInvited={user.showInvited}
            referralCount={user.referrals.length}
          />

          {user.showInvited && <InvitedSection referrals={user.referrals} />}

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
                    thumbnails={deriveRoomThumbnails(
                      room.roomItems.map((roomItem) => roomItem.item),
                    )}
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
