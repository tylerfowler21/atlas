import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { newShareToken } from "@/lib/share";

async function loadOwnedTrip(id: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { share: true },
  });
  return trip && trip.userId === userId ? trip : null;
}

function shareResponse(share: {
  token: string;
  createdAt: Date;
  viewCount: number;
  lastViewedAt: Date | null;
}) {
  return {
    token: share.token,
    // The path only — the client pairs it with its own origin, which stays
    // correct behind a proxy or on a different port.
    path: `/s/${share.token}`,
    createdAt: share.createdAt.toISOString(),
    viewCount: share.viewCount,
    lastViewedAt: share.lastViewedAt?.toISOString() ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const trip = await loadOwnedTrip(id, user.id);
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    share: trip.share ? shareResponse(trip.share) : null,
  });
}

/// Creates the link, or rotates it when one already exists. Rotating breaks
/// every copy of the old URL, which is the only way to un-share something that
/// has already been passed around.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const trip = await loadOwnedTrip(id, user.id);
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const rotate = body?.rotate === true;

  if (trip.share && !rotate) {
    return NextResponse.json({ share: shareResponse(trip.share) });
  }

  const share = await prisma.tripShare.upsert({
    where: { tripId: id },
    // Rotating resets the counters too — they describe the current link, not
    // the trip's lifetime.
    update: { token: newShareToken(), viewCount: 0, lastViewedAt: null, createdAt: new Date() },
    create: { tripId: id, token: newShareToken() },
  });

  return NextResponse.json({ share: shareResponse(share) }, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const trip = await loadOwnedTrip(id, user.id);
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (trip.share) await prisma.tripShare.delete({ where: { tripId: id } });
  return NextResponse.json({ share: null });
}
