import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { copyTripInto } from "@/lib/copy-trip";
import { isBlockedBetween } from "@/lib/moderation";
import { notify } from "@/lib/notifications";

/// Copies a trip somebody sent you the link to.
///
/// The link is the credential, as it is for reading the itinerary — anybody
/// holding it can already see every stop, time and note, so being able to take
/// a copy gives away nothing further. What it needs beyond that is an account
/// to copy it into, which is the one thing reading does not.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { token } = await params;
  const share = await prisma.tripShare.findUnique({
    where: { token },
    select: { trip: { select: { id: true, userId: true, title: true } } },
  });

  // A revoked link is deleted outright, so "not found" covers a bad token and
  // one the owner has since turned off.
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (share.trip.userId === user.id) {
    return NextResponse.json({ error: "That's already your trip" }, { status: 400 });
  }
  if (await isBlockedBetween(user.id, share.trip.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const created = await copyTripInto({ sourceTripId: share.trip.id, userId: user.id });
  if (!created) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await notify({
    userId: share.trip.userId,
    kind: "copy",
    actorId: user.id,
    tripId: share.trip.id,
    tripTitle: share.trip.title,
  });

  return NextResponse.json({ tripId: created.trip.id }, { status: 201 });
}
