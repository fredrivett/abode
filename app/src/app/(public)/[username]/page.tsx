import Image from "next/image";
import { notFound } from "next/navigation";
import db from "@/lib/db";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { username } = await params;

  const user = await db.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: { username: true, firstName: true, lastName: true },
  });

  if (!user) {
    return { title: "User not found" };
  }

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : `@${user.username}`;

  return {
    title: `${displayName} | abode`,
    description: `${displayName}'s profile on abode`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;

  const user = await db.user.findFirst({
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
    },
  });

  if (!user) {
    notFound();
  }

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : null;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
        <div className="flex flex-col items-center text-center">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={displayName || `@${user.username}`}
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
            {displayName || `@${user.username}`}
          </h1>

          {displayName && (
            <p className="mt-1 text-muted-foreground">@{user.username}</p>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Member since{" "}
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
