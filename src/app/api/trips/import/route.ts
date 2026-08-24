import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, tripImportSchema } from "@/lib/validation";

/// Two places within ~50m of each other with the same name are the same place.
const SAME_PLACE_DEGREES = 0.0005;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = tripImportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { trip, entries, markVisited } = parsed.data;
  if (trip.startDate && trip.endDate && trip.endDate < trip.startDate) {
    return NextResponse.json({ error: "The trip ends before it starts" }, { status: 400 });
  }

  const visitedAt = markVisited ? (trip.startDate ?? new Date()) : null;

  const result = await prisma.$transaction(async (tx) => {
    const placeIds = new Map<number, string>();
    let created = 0;
    let reused = 0;

    for (const [index, entry] of entries.entries()) {
      if (!entry.place) continue;
      const p = entry.place;

      // Re-importing a place you already saved should attach to the existing
      // one rather than littering the map with duplicates.
      const existing = await tx.place.findFirst({
        where: {
          userId: user.id,
          name: p.name,
          lat: { gte: p.lat - SAME_PLACE_DEGREES, lte: p.lat + SAME_PLACE_DEGREES },
          lng: { gte: p.lng - SAME_PLACE_DEGREES, lte: p.lng + SAME_PLACE_DEGREES },
        },
        select: { id: true, status: true },
      });

      if (existing) {
        reused += 1;
        // A place already on the wishlist becomes visited if this trip says so.
        if (markVisited && existing.status !== "visited") {
          await tx.place.update({
            where: { id: existing.id },
            data: { status: "visited", visitedAt },
          });
        }
        placeIds.set(index, existing.id);
        continue;
      }

      const place = await tx.place.create({
        data: {
          userId: user.id,
          name: p.name,
          category: entry.category,
          status: markVisited ? "visited" : "wishlist",
          visitedAt,
          lat: p.lat,
          lng: p.lng,
          address: p.address,
          city: p.city,
          country: p.country,
          countryCode: p.countryCode,
        },
      });
      created += 1;
      placeIds.set(index, place.id);
    }

    // Position is per-day, so count within each day rather than overall.
    const positionByDay = new Map<number, number>();

    const saved = await tx.trip.create({
      data: {
        ...trip,
        userId: user.id,
        items: {
          create: entries.map((entry, index) => {
            const position = positionByDay.get(entry.dayIndex) ?? 0;
            positionByDay.set(entry.dayIndex, position + 1);
            return {
              title: entry.title,
              notes: entry.notes,
              dayIndex: entry.dayIndex,
              startTime: entry.startTime,
              category: entry.category,
              position,
              placeId: placeIds.get(index) ?? null,
            };
          }),
        },
      },
    });

    return { tripId: saved.id, created, reused };
  });

  return NextResponse.json(result, { status: 201 });
}
