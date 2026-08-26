/// Restores an roava-export.json onto one account — the other half of
/// scripts/export-roava.ts, used to carry data across the SQLite → Postgres
/// move.
///
///   npm run db:import -- you@example.com
///
/// Ids are regenerated, so this is additive: running it twice duplicates the
/// data rather than overwriting anything.

import { readFileSync } from "node:fs";
import { prisma, resolveTargetUser } from "../src/lib/db-script";

type ExportedPlace = Record<string, unknown> & { id: string };
type ExportedItem = Record<string, unknown> & { id: string; placeId: string | null };
type ExportedTrip = Record<string, unknown> & { id: string; items: ExportedItem[] };

const FILE = process.env.ROAVA_EXPORT ?? "roava-export.json";

function dateOrNull(value: unknown) {
  return typeof value === "string" ? new Date(value) : null;
}

async function main() {
  const user = await resolveTargetUser(true);
  const dump = JSON.parse(readFileSync(FILE, "utf8")) as {
    users: { places: ExportedPlace[]; trips: ExportedTrip[] }[];
  };

  // The export predates accounts, so everything in it belongs to one person.
  const places = dump.users.flatMap((u) => u.places);
  const trips = dump.users.flatMap((u) => u.trips);

  const placeIdMap = new Map<string, string>();

  for (const place of places) {
    const created = await prisma.place.create({
      data: {
        userId: user.id,
        name: String(place.name),
        category: String(place.category ?? "other"),
        status: String(place.status ?? "wishlist"),
        lat: Number(place.lat),
        lng: Number(place.lng),
        address: (place.address as string) ?? null,
        city: (place.city as string) ?? null,
        country: (place.country as string) ?? null,
        countryCode: (place.countryCode as string) ?? null,
        notes: (place.notes as string) ?? null,
        rating: (place.rating as number) ?? null,
        website: (place.website as string) ?? null,
        visitedAt: dateOrNull(place.visitedAt),
      },
    });
    placeIdMap.set(place.id, created.id);
  }

  for (const trip of trips) {
    await prisma.trip.create({
      data: {
        userId: user.id,
        title: String(trip.title),
        destination: (trip.destination as string) ?? null,
        startDate: dateOrNull(trip.startDate),
        endDate: dateOrNull(trip.endDate),
        notes: (trip.notes as string) ?? null,
        color: String(trip.color ?? "#2563eb"),
        items: {
          create: trip.items.map((item) => ({
            title: String(item.title),
            notes: (item.notes as string) ?? null,
            dayIndex: Number(item.dayIndex ?? 0),
            startTime: (item.startTime as string) ?? null,
            category: String(item.category ?? "other"),
            position: Number(item.position ?? 0),
            // A place that failed to import leaves a plain entry behind rather
            // than dropping the stop from the itinerary.
            placeId: item.placeId ? (placeIdMap.get(item.placeId) ?? null) : null,
          })),
        },
      },
    });
  }

  console.log(
    `Imported ${places.length} places and ${trips.length} trips into ${user.email}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
