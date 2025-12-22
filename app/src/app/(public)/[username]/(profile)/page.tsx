import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import db from "@/lib/db";
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
            {user.memberNumber && `Member #${user.memberNumber}, since `}
            {!user.memberNumber && "Member since "}
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
            }).format(user.createdAt)}
          </p>
        </div>
      </main>
    </div>
  );
}
