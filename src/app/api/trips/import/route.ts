import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, tripImportSchema } from "@/lib/validation";
import { tripAccess } from "@/lib/trip-access";
import { ownsCategory } from "@/lib/categories";
import { regionColor, regionOfCountry, type RegionId } from "@/lib/regions";
import { placesForDestinations } from "@/lib/trip-destinations";

/// Two places within ~50m of each other with the same name are the same place.
const SAME_PLACE_DEGREES = 0.0005;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body: unknown = await request.json();
  /// Whether a colour was actually chosen, as opposed to the schema supplying
  /// its default — the difference between "leave this alone" and "nobody said,
  /// so where is it going?".
  const chosen =
    typeof body === "object" &&
    body !== null &&
    "trip" in body &&
    typeof body.trip === "object" &&
    body.trip !== null &&
    "color" in body.trip;

  const parsed = tripImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { trip, tripId, entries, markVisited } = parsed.data;

  if (!trip && !tripId) {
    return NextResponse.json({ error: "Which trip?" }, { status: 400 });
  }
  if (trip?.startDate && trip.endDate && trip.endDate < trip.startDate) {
    return NextResponse.json({ error: "The trip ends before it starts" }, { status: 400 });
  }

  // Appending is only allowed to a trip this person can already edit, checked
  // before anything is written.
  const existingTrip = tripId ? await tripAccess(tripId, user) : null;
  if (tripId && !existingTrip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Categories arrive as ids chosen in the review step, so they are checked
  // the same way any other write checks them — against the built-ins and the
  // trip owner's own.
  const ownerId = existingTrip?.trip.userId ?? user.id;
  for (const entry of entries) {
    if (!(await ownsCategory(ownerId, entry.category))) {
      return NextResponse.json({ error: "No such category" }, { status: 400 });
    }
  }

  const visitedAt = markVisited
    ? (trip?.startDate ?? existingTrip?.trip.startDate ?? new Date())
    : null;

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

    // Position is per-day, so count within each day rather than overall. When
    // appending, each day starts after whatever is already on it — otherwise
    // the new stops claim positions the existing ones already hold.
    const positionByDay = new Map<number, number>();
    if (existingTrip) {
      const already = await tx.itineraryItem.groupBy({
        by: ["dayIndex"],
        where: { tripId: existingTrip.trip.id },
        _count: { _all: true },
      });
      for (const row of already) positionByDay.set(row.dayIndex, row._count._all);
    }

    const itemFor = (entry: (typeof entries)[number], index: number) => {
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
    };

    if (existingTrip) {
      await tx.itineraryItem.createMany({
        data: entries.map((entry, index) => ({
          ...itemFor(entry, index),
          tripId: existingTrip.trip.id,
        })),
      });
      return { tripId: existingTrip.trip.id, created, reused };
    }

    /// Coloured by where it goes, so a list of trips reads as a map before it
    /// reads as words — the same as a trip made any other way.
    ///
    /// Unlike the create route this needs no geocoding at all: the stops came
    /// back from the review step already carrying their own countries.
    ///
    /// Where the most stops are, rather than where the first one is. Half the
    /// itineraries anybody pastes open with the flight out — "Fly from
    /// Charleston" — and going by the first stop paints a fortnight in Japan
    /// with the colour of the airport somebody left from. A tie goes to
    /// whichever came first, so a trip evenly split between two countries
    /// takes the one it starts in.
    const stops = new Map<RegionId, number>();
    for (const entry of entries) {
      const region = regionOfCountry(entry.place?.countryCode);
      if (region) stops.set(region, (stops.get(region) ?? 0) + 1);
    }
    const colour = regionColor(
      [...stops].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    );

    const saved = await tx.trip.create({
      data: {
        ...trip!,
        color: !chosen && colour ? colour : trip!.color,
        userId: user.id,
        items: { create: entries.map(itemFor) },
      },
    });

    return { tripId: saved.id, created, reused };
  });

  /// Where the trip goes, onto the map — the same as a trip made any other
  /// way.
  ///
  /// Only for a new trip: appending a handful of places off a feed to a trip
  /// that already exists says nothing new about where it goes.
  ///
  /// Outside the transaction, and deliberately. This geocodes, which means a
  /// network call and about a second each against the gazetteer's rate limit,
  /// and holding a database transaction open across that is how a slow
  /// afternoon at somebody else's API becomes a lock on ours. Nothing here can
  /// fail the import: the trip is already written and the places are a
  /// convenience on top of it.
  ///
  /// Awaited rather than left running, because this is a serverless function —
  /// work still outstanding when the response goes back is work that may never
  /// finish.
  if (!existingTrip && trip) {
    await placesForDestinations({
      userId: user.id,
      destinations: trip.destinations ?? [],
      endsOn: trip.endDate ?? trip.startDate ?? null,
      // Said outright on the form rather than guessed from the dates, which
      // is the one thing this route knows that the create route does not.
      status: markVisited ? "visited" : "wishlist",
    });
  }

  return NextResponse.json(result, { status: 201 });
}
