import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { feedTripInclude, toFeedTrip } from "@/lib/social";
import FollowButton from "@/components/FollowButton";
import ReportOrBlock from "@/components/ReportOrBlock";
import { isBlockedBetween } from "@/lib/moderation";
import TripCard from "@/components/TripCard";

export const dynamic = "force-dynamic";

async function loadProfile(username: string) {
  return prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      homeCity: true,
      wantsToGo: true,
      travelStyle: true,
      _count: { select: { followers: true, following: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  return {
    title: profile ? `${profile.name ?? profile.username} on Roava` : "Not found",
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) notFound();

  const viewer = await getCurrentUser();

  // A blocked pair should not be able to confirm the other still exists, so
  // this is a 404 rather than a message.
  if (await isBlockedBetween(viewer?.id ?? null, profile.id)) notFound();

  // Only published trips, ever. A profile cannot leak a private one.
  const [trips, follow] = await Promise.all([
    prisma.trip.findMany({
      where: { userId: profile.id, publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      include: feedTripInclude,
    }),
    viewer
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: { followerId: viewer.id, followingId: profile.id },
          },
        })
      : null,
  ]);

  const isSelf = viewer?.id === profile.id;

  /// The names behind your own "following" count.
  ///
  /// Only ever your own. Who somebody follows is a disclosure this profile has
  /// never made, and a number is not the same as a list — the same difference
  /// between findable and listed that the directory draws.
  const followingList = isSelf
    ? await prisma.follow.findMany({
        where: { followerId: profile.id },
        orderBy: { createdAt: "desc" },
        select: {
          following: {
            select: {
              id: true,
              name: true,
              username: true,
              bio: true,
              _count: { select: { trips: { where: { publishedAt: { not: null } } } } },
            },
          },
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-start gap-4">
        {profile.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.image}
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-full object-cover"
          />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-accent/15 text-lg font-semibold text-accent-text">
            {(profile.name ?? profile.username ?? "?").charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">{profile.name ?? profile.username}</h1>
          <p className="text-sm text-muted">
            @{profile.username}
            {profile.homeCity && <> · {profile.homeCity}</>}
          </p>
          {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          <p className="mt-2 text-xs text-muted">
            <span className="font-medium text-foreground tabular-nums">
              {profile._count.followers}
            </span>{" "}
            followers ·{" "}
            <span className="font-medium text-foreground tabular-nums">
              {profile._count.following}
            </span>{" "}
            following
          </p>
        </div>

        {!isSelf && profile.username && (
          <FollowButton
            username={profile.username}
            initiallyFollowing={Boolean(follow)}
            signedIn={Boolean(viewer)}
          />
        )}
      </div>

      {/* Two lines that say more about a stranger than any count of countries
          does. Each stands alone — most people will fill in one and not the
          other, and a heading with nothing under it is worse than no heading. */}
      {(profile.wantsToGo || profile.travelStyle) && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {profile.wantsToGo && (
            <div className="card p-4">
              <dt className="text-xs text-muted">Wants to go</dt>
              <dd className="mt-1 text-sm">{profile.wantsToGo}</dd>
            </div>
          )}
          {profile.travelStyle && (
            <div className="card p-4">
              <dt className="text-xs text-muted">How they travel</dt>
              <dd className="mt-1 text-sm">{profile.travelStyle}</dd>
            </div>
          )}
        </dl>
      )}

      {!isSelf && profile.username && (
        <div className="mt-4">
          <ReportOrBlock
            username={profile.username}
            signedIn={Boolean(viewer)}
          />
        </div>
      )}

      <h2 className="mt-8 mb-2 text-sm font-medium">
        {trips.length} published {trips.length === 1 ? "trip" : "trips"}
      </h2>

      {trips.length === 0 ? (
        <p className="text-sm text-muted">
          {isSelf
            ? "You haven't published anything yet. Open a trip and switch on “Publish to my profile”."
            : "Nothing published yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard trip={toFeedTrip(trip)} showAuthor={false} />
            </li>
          ))}
        </ul>
      )}

      {isSelf && followingList.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg">Following</h2>
          <ul className="divide-y divide-line">
            {followingList.map(({ following: person }) => (
              <li key={person.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${person.username}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {person.name ?? person.username}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    @{person.username} · {person._count.trips} published
                    {person.bio ? ` · ${person.bio}` : ""}
                  </p>
                </div>
                <FollowButton
                  username={person.username!}
                  initiallyFollowing
                  signedIn
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Only you can see this list. Your follower and following counts are
            public; the names are not.
          </p>
        </div>
      )}
    </div>
  );
}
