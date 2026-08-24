/// Optional demo data so a fresh install has something on the map.
/// Run with `npm run db:seed`, clear it again with `npm run db:reset`.

// tsx does not read .env on its own; the app gets it from Next.
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const PLACES = [
  { name: "Time Out Market", category: "restaurant", status: "visited", rating: 4, lat: 38.7067, lng: -9.1459, city: "Lisbon", country: "Portugal", countryCode: "pt", notes: "Go early, it fills up by 1pm." },
  { name: "Miradouro da Senhora do Monte", category: "sight", status: "visited", rating: 5, lat: 38.7168, lng: -9.1334, city: "Lisbon", country: "Portugal", countryCode: "pt", notes: "Best sunset view in the city." },
  { name: "Pastéis de Belém", category: "cafe", status: "wishlist", lat: 38.6975, lng: -9.2035, city: "Lisbon", country: "Portugal", countryCode: "pt", notes: "The original custard tarts." },
  { name: "LX Factory", category: "shop", status: "wishlist", lat: 38.7024, lng: -9.1786, city: "Lisbon", country: "Portugal", countryCode: "pt", notes: null },
  { name: "Sintra — Quinta da Regaleira", category: "activity", status: "wishlist", lat: 38.7962, lng: -9.3963, city: "Sintra", country: "Portugal", countryCode: "pt", notes: "Book the initiation well slot ahead." },
  { name: "Golden Gai", category: "bar", status: "visited", rating: 5, lat: 35.6938, lng: 139.7036, city: "Tokyo", country: "Japan", countryCode: "jp", notes: "Tiny bars, cash only." },
  { name: "Shinjuku Gyoen", category: "nature", status: "visited", rating: 4, lat: 35.6852, lng: 139.71, city: "Tokyo", country: "Japan", countryCode: "jp", notes: null },
  { name: "Teamlab Planets", category: "activity", status: "wishlist", lat: 35.6497, lng: 139.7866, city: "Tokyo", country: "Japan", countryCode: "jp", notes: "Timed tickets." },
  { name: "Café de Flore", category: "cafe", status: "visited", rating: 3, lat: 48.8542, lng: 2.3327, city: "Paris", country: "France", countryCode: "fr", notes: "Touristy, but the terrace is the point." },
  { name: "Musée d'Orsay", category: "sight", status: "visited", rating: 5, lat: 48.86, lng: 2.3266, city: "Paris", country: "France", countryCode: "fr", notes: null },
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "you@atlas.local" },
    update: {},
    create: { email: "you@atlas.local", name: "You" },
  });

  const existing = await prisma.place.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`Skipping seed — you already have ${existing} places saved.`);
    return;
  }

  for (const place of PLACES) {
    await prisma.place.create({
      data: {
        ...place,
        userId: user.id,
        visitedAt: place.status === "visited" ? new Date() : null,
      },
    });
  }

  const lisbon = await prisma.place.findMany({
    where: { userId: user.id, city: { in: ["Lisbon", "Sintra"] } },
  });

  const trip = await prisma.trip.create({
    data: {
      userId: user.id,
      title: "Lisbon, long weekend",
      destination: "Lisbon, Portugal",
      startDate: new Date("2026-09-18"),
      endDate: new Date("2026-09-21"),
      color: "#059669",
    },
  });

  const plan = [
    { day: 0, names: ["Time Out Market", "Miradouro da Senhora do Monte"] },
    { day: 1, names: ["Pastéis de Belém", "LX Factory"] },
    { day: 2, names: ["Sintra — Quinta da Regaleira"] },
  ];

  for (const { day, names } of plan) {
    for (const [position, name] of names.entries()) {
      const place = lisbon.find((p) => p.name === name);
      if (!place) continue;
      await prisma.itineraryItem.create({
        data: {
          tripId: trip.id,
          placeId: place.id,
          title: place.name,
          category: place.category,
          dayIndex: day,
          position,
        },
      });
    }
  }

  console.log(`Seeded ${PLACES.length} places and 1 trip.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
