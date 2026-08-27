import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { visibleTripsWhere } from "@/lib/trip-access";

/// Which trips a place is already on.
///
/// The place panel offers to add somewhere to a trip without saying whether it
/// is on one already, so the same restaurant quietly lands on a day twice. The
/// answer is item-level and the panel only has the trip list, so it is asked
/// for here rather than loaded with every place — most places are never opened.
///
/// Scoped to trips the viewer can see, which includes ones they collaborate on
/// and excludes everyone else's.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const place = await prisma.place.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await prisma.itineraryItem.findMany({
    where: {
      OR: [{ placeId: id }, { toPlaceId: id }],
      trip: visibleTripsWhere(user),
    },
    orderBy: [{ dayIndex: "asc" }, { position: "asc" }],
    select: {
      dayIndex: true,
      kind: true,
      trip: { select: { id: true, title: true, color: true } },
    },
  });

  // One entry per trip, keeping the earliest day it appears on: "on this trip,
  // from day two" is the useful shape, not a list of every time it recurs.
  const byTrip = new Map<
    string,
    { id: string; title: string; color: string; dayIndex: number; times: number }
  >();
  for (const item of items) {
    const existing = byTrip.get(item.trip.id);
    if (existing) {
      existing.times += 1;
      existing.dayIndex = Math.min(existing.dayIndex, item.dayIndex);
    } else {
      byTrip.set(item.trip.id, {
        id: item.trip.id,
        title: item.trip.title,
        color: item.trip.color,
        dayIndex: item.dayIndex,
        times: 1,
      });
    }
  }

  return NextResponse.json({ trips: [...byTrip.values()] });
}
