import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { firstIssue, placeImportSchema } from "@/lib/validation";
import { ownsCategory } from "@/lib/categories";

/// Roughly a hundred metres. Two entries this close with the same name are the
/// same place — the same constant the trip importer uses, for the same reason.
const SAME_PLACE_DEGREES = 0.001;

/// Importing places on their own, with no trip around them.
///
/// The other importer builds a trip because that is what it is for. This one
/// exists because the commonest list anybody has is not a trip at all: it is
/// the restaurants they liked, kept in a note, with no dates and no order.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = placeImportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { entries, status } = parsed.data;

  // Categories arrive as ids chosen in the review step, so they are checked
  // the same way any other write checks them.
  for (const entry of entries) {
    if (!(await ownsCategory(user.id, entry.category))) {
      return NextResponse.json({ error: "No such category" }, { status: 400 });
    }
  }

  const visitedAt = status === "visited" || status === "lived" ? new Date() : null;

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let reused = 0;

    for (const entry of entries) {
      // An entry nobody could place on the map is a line of text, not a place.
      if (!entry.place) continue;
      const p = entry.place;

      // Importing the same list twice should not double the map.
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
        // Somewhere on the wishlist that turns out to have been visited is
        // worth correcting; the reverse is not, so it only ever moves forward.
        if (status !== "wishlist" && existing.status === "wishlist") {
          await tx.place.update({
            where: { id: existing.id },
            data: { status, visitedAt },
          });
        }
        continue;
      }

      await tx.place.create({
        data: {
          userId: user.id,
          name: p.name,
          category: entry.category,
          status,
          visitedAt,
          lat: p.lat,
          lng: p.lng,
          address: p.address,
          city: p.city,
          country: p.country,
          countryCode: p.countryCode,
          notes: entry.notes ?? null,
        },
      });
      created += 1;
    }

    return { created, reused };
  });

  return NextResponse.json(result);
}
