import { DoorOpen, Hand, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/db";
import { formatMemberNumber } from "@/lib/format-member-number";
import { getDisplayName } from "@/lib/get-display-name";

type Props = {
  params: Promise<{ username: string }>;
};

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
      avatarUrl: true,
      createdAt: true,
      memberNumber: true,
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
  const { username } = await params;
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
  const { username } = await params;
  const user = await getUser(username);

  if (!user) {
    notFound();
  }

  const publicRooms = await getPublicRooms(user.id);
  const displayName = getDisplayName(user);
  const showUsername = user.firstName !== null;

  return (
    <div className="flex min-h-screen flex-col">
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
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-3xl font-medium text-muted-foreground">
              {(user.firstName?.[0] || user.username?.[0] || "?").toUpperCase()}
            </div>
          )}

          <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight">
            {displayName}
          </h1>

          {showUsername && (
            <p className="mt-1 text-muted-foreground">@{user.username}</p>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            {user.memberNumber &&
              `Member #${formatMemberNumber(user.memberNumber)}, since `}
            {!user.memberNumber && "Member since "}
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
            }).format(user.createdAt)}
          </p>
        </div>

        {publicRooms.length > 0 && (
          <div className="mt-12">
            <h2 className="flex items-center justify-center gap-2 font-serif text-xl font-semibold">
              <DoorOpen className="size-5 text-muted-foreground" />
              Rooms
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publicRooms.map((room) => (
                <Link
                  key={room.id}
                  href={`/@${user.username}/${room.slug}`}
                  className="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-lg font-serif font-medium leading-none">
                      {room.emoji && <span aria-hidden>{room.emoji}</span>}
                      {room.name}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      Public
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {room._count.roomItems}{" "}
                      {room._count.roomItems === 1 ? "item" : "items"}
                    </span>
                    {room.type === "smart" ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="size-3" />
                          Dynamic
                        </span>
                      </>
                    ) : (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Hand className="size-3" />
                          Static
                        </span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
