import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { hiddenUserIds } from "@/lib/moderation";

/// Places the people you follow have chosen to show you.
///
/// The map's other layer. Yours answers "what have I saved"; this answers the
/// question somebody actually has standing on a street in a city they do not
/// know — "has anyone I trust been near here".
///
/// Four rules hold this together, and the first three are not settings.
///
/// Only people you follow. Following is the consent on the reading side;
/// `sharesVisited` is the consent on the writing side. Both are required.
///
/// Only status "visited". Never "lived", which is an address history and no
/// switch should be able to publish it, and never "wishlist", which is not a
/// recommendation. The filter is here rather than in a caller's query so
/// there is one place to read to know what leaves the building.
///
/// Never journal entries. Those are promised private wherever they are
/// mentioned, and a place's own note is a different field — the sentence about
/// getting there before ten, which is the whole reason this is worth looking
/// at.
///
/// Blocks apply, as everywhere: a block that holds on one surface and not
/// another is not a block.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const [following, hidden] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
    hiddenUserIds(user.id),
  ]);

  const ids = following
    .map((f) => f.followingId)
    .filter((id) => !hidden.includes(id));

  if (ids.length === 0) return NextResponse.json({ places: [] });

  const places = await prisma.place.findMany({
    where: {
      userId: { in: ids },
      status: "visited",
      user: { sharesVisited: true },
    },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      category: true,
      emoji: true,
      city: true,
      country: true,
      notes: true,
      rating: true,
      photoUrl: true,
      /// Whose it is. Attribution rather than anonymity: an unexplained pin is
      /// worth much less than "she has been here", and somebody who turned
      /// this on did so knowing their name travels with it.
      user: { select: { name: true, username: true, image: true } },
    },
    take: 2000,
  });

  return NextResponse.json({ places });
}
