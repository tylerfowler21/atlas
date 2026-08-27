import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import { feedTripInclude, toFeedTrip } from "@/lib/social";
import { hiddenUserIds } from "@/lib/moderation";
import TripCard from "@/components/TripCard";
import FindPeople from "@/components/FindPeople";
import FollowButton from "@/components/FollowButton";

export const metadata: Metadata = { title: "Discover — Roava" };
export const dynamic = "force-dynamic";

/// Feed and People on one page.
///
/// They were separate destinations, but People exists mostly to fill the Feed —
/// following someone is what gives the Feed anything to show — so they are two
/// views of one subject. The app made the same merge; this keeps the two
/// clients describing the product the same way.
///
/// The tab lives in the URL rather than in state, so a link to the people list
/// is a link to the people list.
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const user = await requireUser();
  const { view, q } = await searchParams;
  const people = view === "people";
  const query = q?.trim() ?? "";

  const hidden = new Set(await hiddenUserIds(user.id));

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const followingIds = new Set(following.map((f) => f.followingId));
  const feedIds = [...followingIds].filter((id) => !hidden.has(id));

  const trips =
    people || feedIds.length === 0
      ? []
      : await prisma.trip.findMany({
          where: { userId: { in: feedIds }, publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
          take: 50,
          include: feedTripInclude,
        });

  const directory = people
    ? await prisma.user.findMany({
        where: {
          username: { not: null },
          id: { notIn: [user.id, ...hidden] },
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
          trips: { where: { publishedAt: { not: null } }, select: { id: true } },
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl">Discover</h1>

      <div className="mt-4 inline-flex rounded-lg border border-line p-0.5">
        <Link
          href="/discover"
          className={`rounded-md px-4 py-1.5 text-sm ${
            people ? "text-muted hover:bg-foreground/5" : "bg-accent font-medium text-[color:var(--accent-contrast)]"
          }`}
        >
          Feed
        </Link>
        <Link
          href="/discover?view=people"
          className={`rounded-md px-4 py-1.5 text-sm ${
            people ? "bg-accent font-medium text-[color:var(--accent-contrast)]" : "text-muted hover:bg-foreground/5"
          }`}
        >
          People
        </Link>
      </div>

      {people ? (
        <>
          <p className="mt-4 text-sm text-muted">
            Everyone who has picked a username. Follow someone and their
            published trips show up in your feed.
          </p>

          <form className="mt-4 flex gap-2" action="/discover">
            <input type="hidden" name="view" value="people" />
            <input
              className="input"
              name="q"
              defaultValue={query}
              placeholder="Search by name or username"
              aria-label="Search people"
            />
            <button type="submit" className="btn btn-ghost">
              Search
            </button>
          </form>

          {directory.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              {query ? "Nobody by that name." : "Nobody has picked a username yet."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {directory.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/u/${p.username}`} className="text-sm font-medium hover:underline">
                      {p.name ?? p.username}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      @{p.username} · {p._count.followers} follower
                      {p._count.followers === 1 ? "" : "s"} · {p.trips.length} published
                    </p>
                  </div>
                  <FollowButton
                    username={p.username!}
                    initiallyFollowing={followingIds.has(p.id)}
                    signedIn
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            Trips published by people you follow. Copy any of them into your own
            account and make it your plan.
          </p>

          <div className="mt-4">
            <FindPeople />
          </div>

          {feedIds.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              You aren&apos;t following anyone yet.{" "}
              <Link href="/discover?view=people" className="text-accent-text underline">
                Find people to follow
              </Link>
              .
            </p>
          ) : trips.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              Nobody you follow has published a trip yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {trips.map((trip) => (
                <li key={trip.id}>
                  <TripCard trip={toFeedTrip(trip)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
