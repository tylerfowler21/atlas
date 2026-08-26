import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { feedTripInclude, toFeedTrip } from "@/lib/social";
import { hiddenUserIds } from "@/lib/moderation";

/// Published trips from the people you follow.
///
/// Shares feedTripInclude and toFeedTrip with the web page rather than
/// re-deriving the shape, so the phone and the browser cannot disagree about
/// what a feed entry is. Blocks are applied here for the same reason they are
/// there: a block that only holds on one client is not a block.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const hidden = new Set(await hiddenUserIds(user.id));
  const ids = following.map((f) => f.followingId).filter((id) => !hidden.has(id));

  if (ids.length === 0) return NextResponse.json({ trips: [] });

  const trips = await prisma.trip.findMany({
    where: { userId: { in: ids }, publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: feedTripInclude,
  });

  return NextResponse.json({ trips: trips.map(toFeedTrip) });
}
