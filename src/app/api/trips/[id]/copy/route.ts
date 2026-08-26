import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { notify } from "@/lib/notifications";
import { isBlockedBetween } from "@/lib/moderation";

const SAME_PLACE_DEGREES = 0.0005;

/// Copies someone's published trip into your own account.
///
/// The result is a plan, not a memory: the itinerary and its places come
/// across, but the dates do not — they were their dates — and the places land
/// on your wishlist rather than being marked as somewhere you have been.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const source = await prisma.trip.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ dayIndex: "asc" }, { position: "asc" }], include: { place: true, toPlace: true } },
      user: { select: { id: true, username: true, name: true } },
    },
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

  const created = await prisma.$transaction(async (tx) => {
    const placeIds = new Map<string, string>();

    // Both ends of a travel leg need copying, not just the origin.
    const sourcePlaces = source.items.flatMap((i) => [i.place, i.toPlace]);

    for (const p of sourcePlaces) {
      if (!p || placeIds.has(p.id)) continue;

      const existing = await tx.place.findFirst({
        where: {
          userId: user.id,
          name: p.name,
          lat: { gte: p.lat - SAME_PLACE_DEGREES, lte: p.lat + SAME_PLACE_DEGREES },
          lng: { gte: p.lng - SAME_PLACE_DEGREES, lte: p.lng + SAME_PLACE_DEGREES },
        },
        select: { id: true },
      });

      if (existing) {
        placeIds.set(p.id, existing.id);
        continue;
      }

      // Their notes and rating stay theirs; you get the location.
      const copy = await tx.place.create({
        data: {
          userId: user.id,
          name: p.name,
          category: p.category,
          status: "wishlist",
          lat: p.lat,
          lng: p.lng,
          address: p.address,
          city: p.city,
          country: p.country,
          countryCode: p.countryCode,
        },
      });
      placeIds.set(p.id, copy.id);
    }

    return tx.trip.create({
      data: {
        userId: user.id,
        title: source.title,
        destination: source.destination,
        color: source.color,
        copiedFromId: source.id,
        items: {
          create: source.items.map((item) => ({
            kind: item.kind,
            mode: item.mode,
            title: item.title,
            emoji: item.emoji,
            notes: item.notes,
            dayIndex: item.dayIndex,
            startTime: item.startTime,
            endTime: item.endTime,
            category: item.category,
            position: item.position,
            placeId: item.placeId ? (placeIds.get(item.placeId) ?? null) : null,
            toPlaceId: item.toPlaceId ? (placeIds.get(item.toPlaceId) ?? null) : null,
          })),
        },
      },
    });
  });

  await notify({
    userId: source.userId,
    kind: "copy",
    actorId: user.id,
    tripId: source.id,
    tripTitle: source.title,
  });

  return NextResponse.json({ tripId: created.id }, { status: 201 });
}
