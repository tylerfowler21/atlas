import { prisma } from "@/lib/prisma";
import { geocode } from "@/lib/geocode";

/// Two places within about fifty metres of each other, with the same name, are
/// the same place — the same rule copying a trip uses, for the same reason.
const SAME_PLACE_DEGREES = 0.0005;

/// Where a trip goes, as somewhere on your map.
///
/// Adding a trip to Amsterdam and then finding Amsterdam nowhere in your
/// places is the gap that makes somebody keep a second list. A trip's
/// destinations are the places it is about, so they land on the map with it.
///
/// A trip already over arrives as somewhere you have been. Anything still
/// ahead — or with no dates at all, which is most of them while they are being
/// planned — arrives as somewhere you want to go, because that is what a plan
/// is. Either can be changed afterwards like any other place.
///
/// Never fatal. A destination the gazetteer cannot place is a trip that still
/// gets made; the alternative is refusing to save somebody's trip because a
/// geocoder was having a bad afternoon.
export async function placesForDestinations(input: {
  userId: string;
  destinations: string[];
  /// The day the trip ends, or its start if that is all it has. Undefined for
  /// a trip with no dates.
  endsOn?: Date | null;
  /// Today, passed in rather than read here so a caller can be tested.
  now?: Date;
}) {
  const names = [...new Set(input.destinations.map((d) => d.trim()).filter(Boolean))];
  if (names.length === 0) return;

  const now = input.now ?? new Date();
  const status = input.endsOn && input.endsOn < now ? "visited" : "wishlist";

  for (const name of names) {
    try {
      // The first answer, from the same ranking every search box uses — which
      // now puts the place whose name actually matches at the top.
      const [best] = await geocode(name, null, true);
      if (!best) continue;

      // The label carries the country for picking it out of a list; the place
      // wants what it is called.
      const placeName = best.city ?? best.name;

      const existing = await prisma.place.findFirst({
        where: {
          userId: input.userId,
          name: placeName,
          lat: { gte: best.lat - SAME_PLACE_DEGREES, lte: best.lat + SAME_PLACE_DEGREES },
          lng: { gte: best.lng - SAME_PLACE_DEGREES, lte: best.lng + SAME_PLACE_DEGREES },
        },
        select: { id: true, status: true },
      });

      if (existing) {
        // Somewhere on the wishlist that a finished trip has now been to is
        // somewhere you have been. Never the other way round: a place you
        // marked visited does not become a wish because of a later trip.
        if (status === "visited" && existing.status === "wishlist") {
          await prisma.place.update({
            where: { id: existing.id },
            data: { status: "visited", visitedAt: input.endsOn ?? now },
          });
        }
        continue;
      }

      await prisma.place.create({
        data: {
          userId: input.userId,
          name: placeName,
          category: best.category,
          status,
          lat: best.lat,
          lng: best.lng,
          city: best.city,
          country: best.country,
          countryCode: best.countryCode?.toLowerCase() ?? null,
          visitedAt: status === "visited" ? (input.endsOn ?? now) : null,
        },
      });
    } catch {
      // One destination that could not be placed does not stop the others, and
      // does not stop the trip.
    }
  }
}
