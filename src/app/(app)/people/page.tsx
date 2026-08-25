import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import FollowButton from "@/components/FollowButton";

export const metadata: Metadata = { title: "People — Atlas" };
export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // Only people who have chosen a username are listed. Picking one is what
  // creates a public profile in the first place, so this makes existing public
  // profiles findable rather than exposing anyone who hasn't opted in.
  const people = await prisma.user.findMany({
    where: {
      username: { not: null },
      id: { not: user.id },
      ...(query
        ? {
            OR: [
              { username: { contains: query.toLowerCase() } },
              { name: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      _count: { select: { followers: true } },
      trips: {
        where: { publishedAt: { not: null } },
        select: { id: true },
      },
    },
  });

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const followingIds = new Set(following.map((f) => f.followingId));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold">People</h1>
      <p className="mt-1 text-sm text-muted">
        Everyone who has picked a username. Follow someone and their published
        trips show up in your feed.
      </p>

      <form className="mt-4 flex gap-2" action="/people">
        <input
          className="input"
          name="q"
          defaultValue={query}
          placeholder="Search by name or @username"
        />
        <button type="submit" className="btn btn-ghost shrink-0">
          Search
        </button>
      </form>

      {people.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          {query
            ? `Nobody matches “${query}”.`
            : "Nobody else has picked a username yet. Until someone does, they have no public profile to find."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {people.map((person) => (
            <li key={person.id} className="card flex items-center gap-3 px-4 py-3">
              {person.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.image}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                  {(person.name ?? person.username ?? "?").charAt(0).toUpperCase()}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${person.username}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {person.name ?? person.username}
                </Link>
                <p className="truncate text-xs text-muted">@{person.username}</p>
                {person.bio && (
                  <p className="mt-0.5 truncate text-xs text-muted">{person.bio}</p>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  {person.trips.length}{" "}
                  {person.trips.length === 1 ? "published trip" : "published trips"} ·{" "}
                  {person._count.followers}{" "}
                  {person._count.followers === 1 ? "follower" : "followers"}
                </p>
              </div>

              <FollowButton
                username={person.username!}
                initiallyFollowing={followingIds.has(person.id)}
                signedIn
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-muted">
        You&apos;re listed here once you pick a username at{" "}
        <Link href="/settings" className="text-accent underline">
          your profile
        </Link>
        . Without one you have no public profile and don&apos;t appear.
      </p>
    </div>
  );
}
