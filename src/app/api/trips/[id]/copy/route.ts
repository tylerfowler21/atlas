import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { notify } from "@/lib/notifications";
import { isBlockedBetween } from "@/lib/moderation";
import { copyTripInto } from "@/lib/copy-trip";
import { requestedDays } from "@/lib/copy-days";

/// Copies someone's published trip into your own account.
///
/// The result is a plan, not a memory: the itinerary and its places come
/// across, but the dates do not — they were their dates — and the places land
/// on your wishlist rather than being marked as somewhere you have been.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const source = await prisma.trip.findUnique({
    where: { id },
    select: { id: true, userId: true, title: true, publishedAt: true },
  });

  // Only published trips can be copied — and copying your own is pointless.
  if (!source || !source.publishedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (source.userId === user.id) {
    return NextResponse.json({ error: "That's already your trip" }, { status: 400 });
  }
  if (await isBlockedBetween(user.id, source.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const created = await copyTripInto({
    sourceTripId: source.id,
    userId: user.id,
    days: await requestedDays(request),
  });
  if (!created) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await notify({
    userId: source.userId,
    kind: "copy",
    actorId: user.id,
    tripId: source.id,
    tripTitle: source.title,
  });

  return NextResponse.json({ tripId: created.trip.id }, { status: 201 });
}
