import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { isBlockedBetween } from "@/lib/moderation";
import { feedTripInclude, toFeedTrip } from "@/lib/social";

/// One person's public profile, for the app.
///
/// The website reads the same shape straight out of Prisma on `/u/[username]`;
/// this is the same thing over the wire. Everything it returns is already
/// public to anyone holding the handle — the bio somebody wrote about
/// themselves, where they say they are based, and the trips they chose to
/// publish. Nothing here reaches a private trip or a saved place.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const viewer = await getCurrentUser();
  if (!viewer) return unauthorized();

  const { username } = await params;
  const profile = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      homeCity: true,
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Neither side of a block should be able to confirm the other is still here,
  // so this is the same answer as a handle nobody has taken.
  if (await isBlockedBetween(viewer.id, profile.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [trips, follow] = await Promise.all([
    // Published only, ever. A profile cannot leak a private trip.
    prisma.trip.findMany({
      where: { userId: profile.id, publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      include: feedTripInclude,
    }),
    prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: viewer.id, followingId: profile.id },
      },
      select: { followerId: true },
    }),
  ]);

  return NextResponse.json({
    profile: {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      image: profile.image,
      bio: profile.bio,
      homeCity: profile.homeCity,
      followers: profile._count.followers,
      following: profile._count.following,
      isFollowing: Boolean(follow),
      isSelf: profile.id === viewer.id,
    },
    trips: trips.map(toFeedTrip),
  });
}
