import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { hiddenUserIds } from "@/lib/moderation";

/// Everyone you follow.
///
/// Deliberately not `/api/people?following=1`, which looks like the same
/// question and is not: that one is the invite list, and it leaves out anybody
/// with no email on file because you cannot invite them. Reusing it here would
/// quietly drop people from a list whose whole job is to be complete.
///
/// Yours only. Who somebody follows is a disclosure the profile does not make
/// — the counts are public, the names are not.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const hidden = await hiddenUserIds(user.id);

  const follows = await prisma.follow.findMany({
    where: {
      followerId: user.id,
      ...(hidden.length ? { followingId: { notIn: hidden } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      following: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          bio: true,
          _count: { select: { trips: { where: { publishedAt: { not: null } } } } },
        },
      },
    },
  });

  return NextResponse.json({
    people: follows.map((f) => ({
      id: f.following.id,
      name: f.following.name,
      username: f.following.username,
      image: f.following.image,
      bio: f.following.bio,
      publishedTrips: f.following._count.trips,
    })),
  });
}
