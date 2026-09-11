import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { loadPublishedTrip } from "@/lib/social";
import { isBlockedBetween } from "@/lib/moderation";
import { resolvedCategories } from "@/lib/categories";
import type { PublicTripDTO } from "@/lib/types";

/// One published trip, readable without copying it.
///
/// The website has had this as a page since trips could be published; the app
/// only ever offered "copy into my trips", which is a strange price to pay for
/// reading something somebody chose to publish.
///
/// The same rules the page applies: unpublished trips are 404, so an id cannot
/// be probed, and a block in either direction hides it. The author's own
/// categories come along so their stops keep the icons they gave them.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const found = await loadPublishedTrip(id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const viewer = await getCurrentUser();
  const { trip, items } = found;

  if (await isBlockedBetween(viewer?.id ?? null, trip.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const publicTrip: PublicTripDTO = {
    title: trip.title,
    destination: trip.destination,
    destinations: trip.destinations,
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    color: trip.color,
  };

  const author = await prisma.user.findUnique({
    where: { id: trip.userId },
    select: { username: true, name: true, image: true },
  });

  return NextResponse.json({
    trip: publicTrip,
    items,
    author,
    categories: await resolvedCategories(trip.userId),
  });
}
