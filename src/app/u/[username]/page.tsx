import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
          <p className="text-sm text-muted">@{profile.username}</p>
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
    </div>
  );
}
